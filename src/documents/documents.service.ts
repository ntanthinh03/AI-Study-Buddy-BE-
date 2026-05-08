import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { Conversation, ConversationKind } from './entities/conversation.entity';
import { AIService } from '../common/services/ai.service';
import { ProgressService } from '../progress/progress.service';
import { RagService } from '../modules/rag/rag.service';
import * as fs from 'fs';
import PDFParser from 'pdf2json';
import { UploadedFile } from '../common/types/uploaded-file.type';
import { DOCUMENT_MESSAGES } from '../common/constants/messages';

interface PdfParserErrorData {
  parserError?: Error;
}

interface MessageImagePayload {
  data: Buffer;
  mimeType: string;
  originalName: string;
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
        throw new Error(DOCUMENT_MESSAGES.PDF_NO_EXTRACTABLE_TEXT);
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

      this.logger.log(`DOC | pdf processed: ${document.fileName}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`DOC | pdf failed ${document.id}: ${message}`);
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

      this.logger.log(`DOC | image processed: ${document.fileName}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`DOC | image failed ${document.id}: ${message}`);
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
      await this.ragService.saveKnowledge(
        text,
        document.fileName,
        document.user?.id || '',
        document.id,
      );
      await this.documentsRepository.update(document.id, {
        ragStatus: 'COMPLETED',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`DOC | rag failed ${document.id}: ${message}`);
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

  async saveGeneralMessage(
    userId: string,
    question: string,
    answer: string,
    conversationId?: string,
    title?: string,
    image?: MessageImagePayload,
  ) {
    const conversation = await this.upsertGeneralConversation(
      userId,
      question,
      conversationId,
      title,
    );

    const message = await this.chatRepository.save({
      question,
      answer,
      messageType: 'QA',
      artifactType: null,
      artifactJson: null,
      imageData: image?.data ?? null,
      imageMimeType: image?.mimeType ?? null,
      imageOriginalName: image?.originalName ?? null,
      user: { id: userId },
      document: null,
      conversation: { id: conversation.id },
    });

    return {
      conversationId: conversation.id,
      messageId: message.id,
      question: message.question,
      answer: message.answer,
      createdAt: message.createdAt,
    };
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
    const conversations = await this.conversationRepository.find({
      where: { userId },
      relations: ['document'],
      order: { updatedAt: 'DESC' },
    });

    return conversations.map((conversation) =>
      this.formatConversationResponse(conversation),
    );
  }

  async getConversationMessages(userId: string, conversationId: string) {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, userId },
      relations: ['document'],
    });

    if (!conversation) {
      return [];
    }

    const messages = await this.chatRepository
      .createQueryBuilder('message')
      .leftJoin('message.conversation', 'conversation')
      .leftJoin('message.user', 'user')
      .where('conversation.id = :conversationId', { conversationId })
      .andWhere('user.id = :userId', { userId })
      .orderBy('message.createdAt', 'ASC')
      .getMany();

    return messages.map((message) => this.formatMessageResponse(message));
  }

  async removeConversation(userId: string, conversationId: string) {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      throw new NotFoundException(DOCUMENT_MESSAGES.CONVERSATION_NOT_FOUND);
    }

    await this.conversationRepository.delete(conversation.id);
    return { message: DOCUMENT_MESSAGES.CONVERSATION_DELETED };
  }

  async getGeneralMessageImage(userId: string, messageId: string) {
    const message = await this.chatRepository
      .createQueryBuilder('message')
      .leftJoin('message.user', 'user')
      .addSelect('message.imageData')
      .where('message.id = :messageId', { messageId })
      .andWhere('user.id = :userId', { userId })
      .getOne();

    if (!message?.imageData) {
      throw new NotFoundException(DOCUMENT_MESSAGES.IMAGE_NOT_FOUND);
    }

    const imageBuffer = Buffer.isBuffer(message.imageData)
      ? message.imageData
      : Buffer.from(message.imageData as unknown as string);

    return {
      messageId: message.id,
      mimeType: message.imageMimeType ?? 'application/octet-stream',
      originalName: message.imageOriginalName ?? 'image',
      base64: imageBuffer.toString('base64'),
    };
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

  private async upsertGeneralConversation(
    userId: string,
    preview: string,
    conversationId?: string,
    title?: string,
  ) {
    let conversation: Conversation | null = null;

    if (conversationId) {
      conversation = await this.conversationRepository.findOne({
        where: {
          id: conversationId,
          userId,
          documentId: IsNull(),
        },
      });
    }

    if (!conversation) {
      const generatedTitle =
        title?.trim() ||
        preview.trim().slice(0, 80) ||
        'General Chat';

      conversation = this.conversationRepository.create({
        userId,
        documentId: null,
        title: generatedTitle,
        kind: 'CHAT',
        lastMessagePreview: preview,
        lastArtifactType: null,
        lastMessageAt: new Date(),
      });

      return await this.conversationRepository.save(conversation);
    }

    conversation.lastMessagePreview = preview;
    conversation.lastMessageAt = new Date();
    return await this.conversationRepository.save(conversation);
  }

  async createAndSaveStudyPlan(userId: string, docId: string) {
    const doc = await this.findOne(docId, userId);

    if (!doc.contentText || doc.contentText.trim().length === 0) {
      throw new BadRequestException(
        DOCUMENT_MESSAGES.DOCUMENT_NOT_READY_FOR_STUDY_PLAN,
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
    if (!doc) throw new NotFoundException(DOCUMENT_MESSAGES.DOCUMENT_NOT_FOUND);
    return doc;
  }

  async remove(id: string, userId: string) {
    const doc = await this.findOne(id, userId);

    if (doc.filePath && fs.existsSync(doc.filePath)) {
      try {
        fs.unlinkSync(doc.filePath);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(
          `DOC | unable to delete local file ${doc.filePath}: ${message}`,
        );
      }
    }

    await this.documentsRepository.delete(id);
    return { message: DOCUMENT_MESSAGES.DOCUMENT_DELETED };
  }

  private formatConversationResponse(conversation: Conversation) {
    return {
      conversationId: conversation.id,
      conversationTitle: conversation.title,
      conversationKind: conversation.kind,
      documentId: conversation.documentId,
      lastMessagePreview: conversation.lastMessagePreview,
      lastArtifactType: conversation.lastArtifactType,
      lastMessageAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  private formatMessageResponse(message: ChatMessage) {
    return {
      messageId: message.id,
      conversationId: message.conversation?.id ?? null,
      messageType: message.messageType,
      artifactType: message.artifactType,
      messageLabel:
        message.question?.trim() || message.artifactType || 'Message',
      question: message.question,
      answer: message.answer,
      artifactJson: message.artifactJson,
      createdAt: message.createdAt,
    };
  }
}
