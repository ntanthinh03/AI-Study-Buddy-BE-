import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { Ollama, OllamaEmbeddings } from '@langchain/ollama';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { PDFParse } from 'pdf-parse';

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
  private readonly ollamaBaseUrl = (
    process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
  ).replace(/\/$/, '');
  private readonly ollamaVisionModel =
    process.env.OLLAMA_VISION_MODEL ?? 'llama3.2-vision:11b';

  private model = new Ollama({
    baseUrl: 'http://localhost:11434',
    model: 'phi3:medium-128k',
    temperature: 0.3,
  });

  private embeddings = new OllamaEmbeddings({ model: 'bge-m3' });

  private connectionOptions = {
    postgresConnectionOptions: {
      connectionString: process.env.DATABASE_URL,
    },
    tableName: 'english_knowledge',
  };

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
        this.logger.warn(
          'pgvector extension is unavailable. Falling back to in-memory vector store (non-persistent).',
        );
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
            content:
              'You are an OCR assistant. Extract text from images accurately and return plain text only in English.',
          },
          {
            role: 'user',
            content:
              'Extract all readable text from this image. Return plain text only, no markdown, no JSON.',
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
      throw new InternalServerErrorException('AI processing failed.');
    }
  }
  async saveKnowledge(text: string, source: string) {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Input text is empty');
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
      this.logger.error(`RAG text ingestion failed: ${message}`);
      throw new InternalServerErrorException('Text ingestion failed.');
    }
  }
  async processPdf(fileBuffer: Buffer, fileName: string) {
    try {
      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error('Uploaded PDF buffer is empty');
      }

      const data = await this.parsePdfBuffer(fileBuffer);
      const extractedText = (data?.text ?? '').trim();
      if (!extractedText) {
        throw new Error('No extractable text found in PDF');
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
      this.logger.error(`RAG PDF ingestion failed (${fileName}): ${message}`);
      throw new InternalServerErrorException('Ingestion failed.');
    }
  }

  async processImage(fileBuffer: Buffer, fileName: string, mimeType: string) {
    try {
      if (!mimeType.startsWith('image/')) {
        throw new Error('Invalid image mime type');
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error('Uploaded image buffer is empty');
      }

      const extractedText = await this.extractImageText(fileBuffer);
      if (!extractedText) {
        throw new Error('No extractable text found in image');
      }

      return await this.saveKnowledge(extractedText, fileName);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`RAG image ingestion failed (${fileName}): ${message}`);
      throw new InternalServerErrorException('Image ingestion failed.');
    }
  }
}
