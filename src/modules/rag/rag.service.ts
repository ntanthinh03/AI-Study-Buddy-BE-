import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Ollama, OllamaEmbeddings } from '@langchain/ollama';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { PDFParse } from 'pdf-parse';
import { normalizeOllamaBaseUrl } from '../../common/config/ollama.config';
import { RAG_MESSAGES } from '../../common/constants/messages';
import { AI_PROMPTS } from '../../common/constants/ai-prompts';

type RagMetadata = { source?: string };
type RagDocument = Document<RagMetadata>;

interface VectorStoreLike {
  similaritySearch(query: string, k: number): Promise<RagDocument[]>;
  addDocuments(documents: RagDocument[]): Promise<void>;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private memoryVectorStore: MemoryVectorStore | null = null;
  private readonly ollamaBaseUrl: string;
  private readonly ollamaVisionModel: string;

  private model: Ollama;
  private embeddings: OllamaEmbeddings;

  constructor(private readonly configService: ConfigService) {
    this.ollamaBaseUrl = normalizeOllamaBaseUrl(
      this.configService.get<string>('OLLAMA_BASE_URL'),
    );
    this.ollamaVisionModel =
      this.configService.get<string>('OLLAMA_VISION_MODEL') ??
      'llama3.2-vision:11b';

    this.model = new Ollama({
      baseUrl: this.ollamaBaseUrl,
      model: this.configService.get<string>('OLLAMA_TEXT_MODEL') ?? 'phi3:medium-128k',
      temperature: 0.3,
    });

    this.embeddings = new OllamaEmbeddings({ 
      model: this.configService.get<string>('OLLAMA_EMBEDDING_MODEL') ?? 'bge-m3' 
    });
  }

  private get connectionOptions() {
    return {
      postgresConnectionOptions: {
        connectionString: this.configService.get<string>('DATABASE_URL'),
      },
      tableName: 'english_knowledge',
    };
  }

  private async getVectorStore(): Promise<VectorStoreLike> {
    try {
      const vectorStore = await PGVectorStore.initialize(
        this.embeddings,
        this.connectionOptions,
      );
      return vectorStore as unknown as VectorStoreLike;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('extension "vector" is not available')) {
        throw error;
      }

      if (!this.memoryVectorStore) {
        this.memoryVectorStore = new MemoryVectorStore(this.embeddings);
        this.logger.warn(RAG_MESSAGES.PGVECTOR_UNAVAILABLE);
      }

      return this.memoryVectorStore as unknown as VectorStoreLike;
    }
  }

  private getSource(metadata: RagMetadata | undefined): string {
    return metadata?.source ?? 'Unknown';
  }

  private async parsePdfBuffer(fileBuffer: Buffer): Promise<{ text?: string }> {
    const parser = new PDFParse({ data: fileBuffer });
    try {
      const result = await parser.getText({});
      return { text: result.text };
    } finally {
      await parser.destroy();
    }
  }

  private getOllamaFallbackBaseUrl(): string | null {
    if (this.ollamaBaseUrl.includes('localhost')) {
      return this.ollamaBaseUrl.replace('localhost', '127.0.0.1');
    }
    return null;
  }

  private async requestVision(
    baseUrl: string,
    imageBuffer: Buffer,
  ): Promise<Response> {
    const imageBase64 = imageBuffer.toString('base64');
    return fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.ollamaVisionModel,
        messages: [
          {
            role: 'system',
            content: AI_PROMPTS.OCR_SYSTEM,
          },
          {
            role: 'user',
            content: AI_PROMPTS.OCR_USER,
            images: [imageBase64],
          },
        ],
        stream: false,
      }),
    });
  }

  private async extractTextFromVisionResponse(
    response: Response,
  ): Promise<string> {
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Vision request failed (${response.status}): ${errorText}`,
      );
    }

    const payload = (await response.json()) as {
      message?: { content?: string };
      response?: string;
    };
    return (payload.message?.content ?? payload.response ?? '').trim();
  }

  private async extractImageText(imageBuffer: Buffer): Promise<string> {
    try {
      const response = await this.requestVision(
        this.ollamaBaseUrl,
        imageBuffer,
      );
      return await this.extractTextFromVisionResponse(response);
    } catch (primaryError: unknown) {
      const fallback = this.getOllamaFallbackBaseUrl();
      if (!fallback) {
        throw primaryError;
      }

      const response = await this.requestVision(fallback, imageBuffer);
      return await this.extractTextFromVisionResponse(response);
    }
  }

  async getRelevantContext(query: string) {
    const vectorStore = await this.getVectorStore();
    const docs = await vectorStore.similaritySearch(query, 5);

    return {
      context: docs.map((d) => d.pageContent).join('\n\n'),
      sources: [...new Set(docs.map((d) => d.metadata.source || 'Unknown'))],
    };
  }
  async answerQuestion(userQuery: string) {
    try {
      const vectorStore = await this.getVectorStore();
      const relevantDocs = await vectorStore.similaritySearch(userQuery, 5);

      if (relevantDocs.length === 0)
        return { answer: 'No info found.', sources: [] };

      const contextText = relevantDocs
        .map((doc) => doc.pageContent)
        .join('\n\n');

      const prompt = `Context: ${contextText}\n\nQuestion: ${userQuery}`;

      const response = await this.model.invoke(prompt);
      const answer = typeof response === 'string' ? response : String(response);

      return {
        answer: answer.trim(),
        sources: [
          ...new Set(relevantDocs.map((d) => this.getSource(d.metadata))),
        ],
      };
    } catch {
      throw new InternalServerErrorException(RAG_MESSAGES.AI_PROCESSING_FAILED);
    }
  }
  async saveKnowledge(text: string, source: string) {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error(RAG_MESSAGES.INPUT_TEXT_EMPTY);
      }

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const chunks = await splitter.splitText(text);
      const docs = chunks.map(
        (chunk) =>
          new Document({
            pageContent: chunk,
            metadata: { source: source },
          }),
      );

      const vectorStore = await this.getVectorStore();
      await vectorStore.addDocuments(docs);

      return { success: true, chunks: docs.length };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`RAG | text ingest failed: ${message}`);
      throw new InternalServerErrorException(RAG_MESSAGES.TEXT_INGESTION_FAILED);
    }
  }
  async processPdf(fileBuffer: Buffer, fileName: string) {
    try {
      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error(RAG_MESSAGES.UPLOADED_PDF_BUFFER_EMPTY);
      }

      const data = await this.parsePdfBuffer(fileBuffer);
      const extractedText = (data?.text ?? '').trim();
      if (!extractedText) {
        throw new Error(RAG_MESSAGES.NO_EXTRACTABLE_TEXT_IN_PDF);
      }

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const chunks = await splitter.splitText(extractedText);
      const docs = chunks.map(
        (chunk) =>
          new Document({
            pageContent: chunk,
            metadata: { source: fileName },
          }),
      );

      const vectorStore = await this.getVectorStore();
      await vectorStore.addDocuments(docs);

      return { success: true, chunks: docs.length };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`RAG | pdf ingest failed ${fileName}: ${message}`);
      throw new InternalServerErrorException(RAG_MESSAGES.PDF_INGESTION_FAILED);
    }
  }

  async processImage(fileBuffer: Buffer, fileName: string, mimeType: string) {
    try {
      if (!mimeType.startsWith('image/')) {
        throw new Error(RAG_MESSAGES.INVALID_IMAGE_MIME_TYPE);
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error(RAG_MESSAGES.UPLOADED_IMAGE_BUFFER_EMPTY);
      }

      const extractedText = await this.extractImageText(fileBuffer);
      if (!extractedText) {
        throw new Error(RAG_MESSAGES.NO_EXTRACTABLE_TEXT_IN_IMAGE);
      }

      return await this.saveKnowledge(extractedText, fileName);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`RAG | image ingest failed ${fileName}: ${message}`);
      throw new InternalServerErrorException(RAG_MESSAGES.IMAGE_INGESTION_FAILED);
    }
  }
}
