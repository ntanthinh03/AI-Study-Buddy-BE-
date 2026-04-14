import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { Conversation, ConversationKind } from './entities/conversation.entity';
import { AIService } from './ai.service';
import { ProgressService } from '../progress/progress.service';
import { RagService } from '../modules/rag/rag.service';
import * as fs from 'fs';
import PDFParser from 'pdf2json';
import { UploadedFile } from '../common/types/uploaded-file.type';

interface PdfParserErrorData {
  parserError?: Error;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,

    @InjectRepository(ChatMessage)
    private chatRepository: Repository<ChatMessage>,

    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,

    private aiService: AIService,
    private progressService: ProgressService,
    private ragService: RagService,
  ) {}

  async create(file: UploadedFile, userId: string) {
    const doc = await this.documentsRepository.save({
      fileName: file.originalname,
      fileSize: file.size,
      filePath: file.path,
      user: { id: userId },
      status: 'PROCESSING',
      summaryStatus: 'PROCESSING',
      ragStatus: 'PENDING',
    });

    const input = file.path || file.buffer;
    const mimeType = file.mimetype || this.inferMimeType(file.originalname);
    void this.processUploadedFile(doc, input, mimeType);

    return doc;
  }

  private inferMimeType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();

    if (extension === 'png') return 'image/png';
    if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
    if (extension === 'webp') return 'image/webp';
    return 'application/pdf';
  }

  private isImageMimeType(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  private async processUploadedFile(
    document: Document,
    input: string | Buffer,
    mimeType: string,
  ) {
    if (this.isImageMimeType(mimeType)) {
      const imageBuffer = Buffer.isBuffer(input)
        ? input
        : fs.readFileSync(input);
      await this.processImageAndSummarize(document, imageBuffer, mimeType);
      return;
    }

    await this.extractAndSummarize(document, input);
  }

  async extractAndSummarize(document: Document, input: string | Buffer) {
    const pdfParser = new PDFParser(null, true);

    try {
      const extractedText = await new Promise<string>((resolve, reject) => {
        pdfParser.on(
          'pdfParser_dataError',
          (errData: Error | PdfParserErrorData) => {
            if (errData instanceof Error) {
              reject(errData);
              return;
            }

            reject(errData.parserError ?? new Error('PDF parser failed'));
          },
        );
        pdfParser.on('pdfParser_dataReady', () =>
          resolve(pdfParser.getRawTextContent()),
        );

        if (Buffer.isBuffer(input)) {
          void pdfParser.parseBuffer(input);
        } else {
          void pdfParser.loadPDF(input);
        }
      });

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('PDF does not contain extractable text');
      }

      const cleanText = extractedText.substring(0, 15000);
      await this.documentsRepository.update(document.id, {
        contentText: cleanText,
        status: 'SUMMARIZING',
        summaryStatus: 'PROCESSING',
      });

      const summary = await this.aiService.generateSummary(cleanText);

      await this.documentsRepository.update(document.id, {
        summary,
        status: 'COMPLETED',
        summaryStatus: 'COMPLETED',
      });

      await this.ingestRagKnowledge(document, cleanText);

      this.logger.log(
        `Success: ${document.fileName} processed successfully.`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to process PDF ${document.id}: ${message}`);
      await this.documentsRepository.update(document.id, {
        status: 'FAILED',
        summaryStatus: 'FAILED',
        ragStatus: 'FAILED',
      });
    }
  }

  async processImageAndSummarize(
    document: Document,
    imageBuffer: Buffer,
    mimeType: string,
  ) {
    try {
      await this.documentsRepository.update(document.id, {
        status: 'SUMMARIZING',
        summaryStatus: 'PROCESSING',
      });

      const { extractedText, summary } =
        await this.aiService.analyzeImageAndSummarize(imageBuffer, mimeType);

      await this.documentsRepository.update(document.id, {
        contentText: extractedText,
        summary,
        status: 'COMPLETED',
        summaryStatus: 'COMPLETED',
      });

      await this.ingestRagKnowledge(document, extractedText);

      this.logger.log(
        `Success: image ${document.fileName} processed successfully.`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to process image ${document.id}: ${message}`);
      await this.documentsRepository.update(document.id, {
        status: 'FAILED',
        summaryStatus: 'FAILED',
        ragStatus: 'FAILED',
      });
    }
  }

  private async ingestRagKnowledge(document: Document, text: string) {
    if (!text || text.trim().length === 0) {
      await this.documentsRepository.update(document.id, {
        ragStatus: 'SKIPPED',
      });
      return;
    }

    await this.documentsRepository.update(document.id, {
      ragStatus: 'PROCESSING',
    });

    try {
      await this.ragService.saveKnowledge(text, document.fileName);
      await this.documentsRepository.update(document.id, {
        ragStatus: 'COMPLETED',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `RAG ingestion failed for document ${document.id}: ${message}`,
      );
      await this.documentsRepository.update(document.id, {
        ragStatus: 'FAILED',
      });
    }
  }

  async saveMessage(
    userId: string,
    docId: string,
    question: string,
    answer: string,
  ) {
    const conversation = await this.upsertConversation(
      userId,
      docId,
      'CHAT',
      question,
    );

    return await this.chatRepository.save({
      question,
      answer,
      messageType: 'QA',
      artifactType: null,
      artifactJson: null,
      user: { id: userId },
      document: { id: docId },
      conversation: { id: conversation.id },
    });
  }

  async saveArtifactMessage(
    userId: string,
    docId: string,
    artifactType: 'QUIZ' | 'STUDY_PLAN',
    artifactJson: unknown,
    note?: string,
  ) {
    const conversation = await this.upsertConversation(
      userId,
      docId,
      artifactType === 'QUIZ' ? 'QUIZ' : 'PLAN',
      note ?? null,
      artifactType,
    );

    return await this.chatRepository.save({
      question: note ?? null,
      answer: null,
      messageType: 'ARTIFACT',
      artifactType,
      artifactJson,
      user: { id: userId },
      document: { id: docId },
      conversation: { id: conversation.id },
    });
  }

  async getConversationsByUser(userId: string) {
    return await this.conversationRepository.find({
      where: { userId },
      relations: ['document'],
      order: { updatedAt: 'DESC' },
    });
  }

  async getConversationMessages(userId: string, conversationId: string) {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, userId },
      relations: ['document'],
    });

    if (!conversation) {
      return [];
    }

    return await this.chatRepository.find({
      where: {
        conversation: { id: conversationId },
        user: { id: userId },
      },
      order: { createdAt: 'ASC' },
    });
  }

  private async upsertConversation(
    userId: string,
    docId: string,
    kind: ConversationKind,
    preview?: string | null,
    artifactType?: 'QUIZ' | 'STUDY_PLAN' | null,
  ) {
    const document = await this.findOne(docId, userId);
    const title = document.fileName;

    let conversation = await this.conversationRepository.findOne({
      where: { userId, documentId: docId },
    });

    if (!conversation) {
      conversation = this.conversationRepository.create({
        userId,
        documentId: docId,
        title,
        kind,
        lastMessagePreview: preview ?? null,
        lastArtifactType: artifactType ?? null,
        lastMessageAt: new Date(),
      });
    } else {
      conversation.title = title;
      conversation.kind =
        kind === 'CHAT' && conversation.kind !== 'CHAT'
          ? conversation.kind
          : kind;
      conversation.lastMessagePreview =
        preview ?? conversation.lastMessagePreview;
      conversation.lastArtifactType =
        artifactType ?? conversation.lastArtifactType;
      conversation.lastMessageAt = new Date();
    }

    return await this.conversationRepository.save(conversation);
  }

  async createAndSaveStudyPlan(userId: string, docId: string) {
    const doc = await this.findOne(docId, userId);

    if (!doc.contentText || doc.contentText.trim().length === 0) {
      throw new BadRequestException(
        'Tai lieu chua san sang de tao study plan.',
      );
    }

    const plan = await this.aiService.generateStudyPlan(
      doc.contentText,
      docId,
      doc.fileName,
    );

    await this.saveArtifactMessage(
      userId,
      docId,
      'STUDY_PLAN',
      plan,
      'Generated study plan',
    );

    return plan;
  }

  async getChatHistory(docId: string, userId: string) {
    return await this.chatRepository.find({
      where: {
        document: { id: docId },
        user: { id: userId },
      },
      order: { createdAt: 'ASC' },
    });
  }

  async findAllByUser(userId: string) {
    return await this.documentsRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string) {
    const doc = await this.documentsRepository.findOne({
      where: { id, user: { id: userId } },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async remove(id: string, userId: string) {
    const doc = await this.findOne(id, userId);

    if (doc.filePath && fs.existsSync(doc.filePath)) {
      try {
        fs.unlinkSync(doc.filePath);
      } catch {
      }
    }

    await this.documentsRepository.delete(id);
    return { message: 'Document and related data deleted successfully.' };
  }
}
