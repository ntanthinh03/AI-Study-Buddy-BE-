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
import { Quiz } from '../quizzes/entities/quiz.entity';
import { Flashcard } from '../modules/flashcards/entities/flashcard.entity';
import * as fs from 'fs';
import { PDFParse } from 'pdf-parse';
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

    @InjectRepository(Quiz)
    private quizRepository: Repository<Quiz>,

    @InjectRepository(Flashcard)
    private flashcardRepository: Repository<Flashcard>,

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
    try {
      let data: Buffer;
      if (Buffer.isBuffer(input)) {
        data = input;
      } else {
        data = fs.readFileSync(input);
      }

      const pdfParser = new PDFParse({ data });
      const result = await pdfParser.getText();
      const extractedText = result.text;

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error(DOCUMENT_MESSAGES.PDF_NO_EXTRACTABLE_TEXT);
      }

      const cleanText = extractedText;
      await this.documentsRepository.update(document.id, {
        contentText: cleanText,
        status: 'SUMMARIZING',
        summaryStatus: 'PROCESSING',
      });

      const summaryText = cleanText.substring(0, 15000);
      const summary = await this.aiService.generateSummary(summaryText);

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
    conversationId?: string,
  ) {
    const conversation = await this.upsertConversation(
      userId,
      docId,
      'CHAT',
      question,
      null,
      conversationId
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

  async getConversationDocumentIds(conversationId: string): Promise<string[]> {
    const rows = await this.chatRepository
      .createQueryBuilder('msg')
      .select('DISTINCT msg.document_id', 'docId')
      .where('msg.conversation_id = :conversationId', { conversationId })
      .andWhere('msg.document_id IS NOT NULL')
      .getRawMany();
    return rows.map(r => r.docId);
  }

  async getAllConversationDocumentIds(conversationId: string, userId: string): Promise<string[]> {
    const docIds = new Set<string>();

    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, userId }
    });
    if (conversation && conversation.documentId) {
      docIds.add(conversation.documentId);
    }

    const msgDocIds = await this.getConversationDocumentIds(conversationId);
    for (const id of msgDocIds) {
      if (id) docIds.add(id);
    }

    return Array.from(docIds);
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
    artifactType: 'QUIZ' | 'STUDY_PLAN' | 'FLASHCARDS' | 'MINDMAP',
    artifactJson: unknown,
    note?: string,
  ) {
    if (artifactType === 'STUDY_PLAN') {
      const existing = await this.chatRepository.findOne({
        where: {
          document: { id: docId },
          user: { id: userId },
          artifactType: 'STUDY_PLAN',
        },
      });
      if (existing) {
        this.logger.log(`saveArtifactMessage | STUDY_PLAN already exists for docId=${docId}, skipping duplicate save.`);
        return existing;
      }
    }

    const conversation = await this.upsertConversation(
      userId,
      docId,
      'CHAT',
      note ?? null,
      artifactType,
    );

    const insertResult = await this.chatRepository.insert({
      question: note ?? null,
      answer: null,
      messageType: 'ARTIFACT',
      artifactType,
      artifactJson,
      user: { id: userId } as any,
      document: { id: docId } as any,
      conversation: { id: conversation.id } as any,
    });

    const savedChat = {
      id: insertResult.identifiers[0].id,
      question: note ?? null,
      answer: null,
      messageType: 'ARTIFACT',
      artifactType,
      artifactJson,
      user: { id: userId },
      document: { id: docId },
      conversation: { id: conversation.id },
      createdAt: new Date(),
    } as unknown as ChatMessage;

    if (artifactType === 'QUIZ' && Array.isArray(artifactJson)) {
      try {
        await this.quizRepository.insert({
          quizName: note || 'Chat Generated Quiz',
          quizTitle: 'Quiz',
          questions: artifactJson as any[],
          document: { id: docId } as any,
          user: { id: userId } as any,
          conversation: { id: conversation.id } as any,
        });
      } catch (e) {
        this.logger.error(`Failed to save quiz to DB: ${e instanceof Error ? e.message : 'Unknown'}`);
      }
    } else if (artifactType === 'FLASHCARDS' && Array.isArray(artifactJson)) {
      try {
        const flashcards = artifactJson.map((data: any) => {
          const f = new Flashcard();
          f.front = data.front || data.question || '';
          f.back = data.back || data.answer || '';
          f.user = { id: userId } as any;
          f.document = { id: docId } as any;
          f.nextReview = new Date();
          return f;
        });
        if (flashcards.length > 0) {
          await this.flashcardRepository.insert(flashcards);
        }
      } catch (e) {
        this.logger.error(`Failed to save flashcards to DB: ${e instanceof Error ? e.message : 'Unknown'}`);
      }
    }

    return savedChat;
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
      .leftJoinAndSelect('message.document', 'document')
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

    if (conversation.documentId) {
      const document = await this.documentsRepository.findOne({
        where: {
          id: conversation.documentId,
          user: { id: userId },
        },
      });

      if (document?.filePath && fs.existsSync(document.filePath)) {
        try {
          fs.unlinkSync(document.filePath);
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(
            `DOC | unable to delete local file ${document.filePath}: ${message}`,
          );
        }
      }

      await this.chatRepository
        .createQueryBuilder()
        .delete()
        .from(ChatMessage)
        .where('document_id = :documentId', {
          documentId: conversation.documentId,
        })
        .execute();

      await this.documentsRepository.delete(conversation.documentId);
    } else {
      await this.conversationRepository.delete(conversation.id);
    }

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

  private isDefaultTitle(title: string | null | undefined, fileName?: string): boolean {
    if (!title) return true;
    const trimmed = title.trim();
    if (
      trimmed === '' ||
      trimmed === 'Chat' ||
      trimmed === 'Document Chat' ||
      trimmed === 'General Chat' ||
      trimmed === 'General Chat - null'
    ) {
      return true;
    }
    if (fileName && trimmed === fileName.trim()) return true;

    const lower = trimmed.toLowerCase();
    if (
      lower.endsWith('.pdf') ||
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.webp')
    ) {
      return true;
    }
    return false;
  }

  private triggerBackgroundSmartTitle(conversationId: string, textToUse: string, type: string) {
    if (!textToUse || textToUse.trim().length === 0) return;

    void (async () => {
      try {
        let smartTitle = await this.aiService.generateSmartTitle(textToUse.substring(0, 5000), type);
        if (smartTitle) {
          smartTitle = smartTitle.replace(/^["']|["']$/g, '').trim();
          if (smartTitle.length > 0 && !this.isDefaultTitle(smartTitle)) {
            await this.conversationRepository.update(conversationId, { title: smartTitle });
            this.logger.log(`DOC | Auto-renamed conversation ${conversationId} to: "${smartTitle}"`);
          }
        }
      } catch (err) {
        this.logger.error(`DOC | Failed to generate smart title for conversation ${conversationId}:`, err);
      }
    })();
  }

  async renameConversation(userId: string, conversationId: string, title: string) {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, userId },
      relations: ['document'],
    });

    if (!conversation) {
      throw new NotFoundException(DOCUMENT_MESSAGES.CONVERSATION_NOT_FOUND);
    }

    const cleanTitle = title.replace(/^["']|["']$/g, '').trim();
    await this.conversationRepository.update(conversation.id, { title: cleanTitle });
    conversation.title = cleanTitle;
    return this.formatConversationResponse(conversation);
  }

  private async upsertConversation(
    userId: string,
    docId: string,
    kind: ConversationKind,
    preview?: string | null,
    artifactType?: 'QUIZ' | 'STUDY_PLAN' | 'FLASHCARDS' | 'MINDMAP' | null,
    conversationId?: string,
  ) {
    const document = await this.findOne(docId, userId);
    const title = document.fileName;

    let conversation: Conversation | null = null;

    if (conversationId) {
      conversation = await this.conversationRepository.findOne({
        where: { id: conversationId, userId },
      });
    }

    if (!conversation) {
      conversation = await this.conversationRepository.findOne({
        where: { userId, documentId: docId },
      });
    }

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
      conversation = await this.conversationRepository.save(conversation);
    } else {
      // use query builder update insted of save because save checks all relations and throws errors
      const updatePayload: any = {};
      if (this.isDefaultTitle(conversation.title, document.fileName)) {
        conversation.title = title;
        updatePayload.title = title;
      }
      if (!conversation.documentId) {
        conversation.documentId = docId;
        updatePayload.documentId = docId;
      }
      const newKind =
        kind === 'CHAT' && conversation.kind !== 'CHAT'
          ? conversation.kind
          : kind;
      if (conversation.kind !== newKind) {
        conversation.kind = newKind;
        updatePayload.kind = newKind;
      }
      if (preview !== undefined) {
        conversation.lastMessagePreview = preview;
        updatePayload.lastMessagePreview = preview;
      }
      if (artifactType !== undefined) {
        conversation.lastArtifactType = artifactType;
        updatePayload.lastArtifactType = artifactType;
      }
      const now = new Date();
      conversation.lastMessageAt = now;
      updatePayload.lastMessageAt = now;

      await this.conversationRepository
        .createQueryBuilder()
        .update(Conversation)
        .set(updatePayload)
        .where('id = :id', { id: conversation.id })
        .execute();
    }

    if (this.isDefaultTitle(conversation.title, document.fileName)) {
      const textToUse = document.summary || document.contentText || '';
      if (textToUse.trim().length > 0) {
        this.triggerBackgroundSmartTitle(conversation.id, textToUse, 'Document Summary');
      }
    }

    return conversation;
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

      const savedConversation = await this.conversationRepository.save(conversation);
      if (this.isDefaultTitle(savedConversation.title)) {
        this.triggerBackgroundSmartTitle(savedConversation.id, preview, 'Chat');
      }
      return savedConversation;
    }

    const now = new Date();
    await this.conversationRepository.update(conversation.id, {
      lastMessagePreview: preview,
      lastMessageAt: now,
    });
    conversation.lastMessagePreview = preview;
    conversation.lastMessageAt = now;
    if (this.isDefaultTitle(conversation.title)) {
      this.triggerBackgroundSmartTitle(conversation.id, preview, 'Chat');
    }
    return conversation;
  }

  async createAndSaveStudyPlan(userId: string, docId: string) {
    const doc = await this.findOne(docId, userId);

    if (!doc.contentText || doc.contentText.trim().length === 0) {
      throw new BadRequestException(
        DOCUMENT_MESSAGES.DOCUMENT_NOT_READY_FOR_STUDY_PLAN,
      );
    }

    const existingMessage = await this.chatRepository.findOne({
      where: {
        document: { id: docId },
        user: { id: userId },
        artifactType: 'STUDY_PLAN',
      },
      order: { createdAt: 'DESC' },
    });

    if (existingMessage && existingMessage.artifactJson) {
      this.logger.log(`STUDY_PLAN_DEBUG | Found existing study plan for docId=${docId}, returning cached plan.`);
      return existingMessage.artifactJson;
    }

    this.logger.log(`STUDY_PLAN_DEBUG | docId=${docId} fileName="${doc.fileName}" contentText.length=${doc.contentText.length}`);
    this.logger.log(`STUDY_PLAN_DEBUG | first 500 chars of contentText: ${doc.contentText.substring(0, 500)}`);

    const plan = await this.aiService.generateStudyPlan(
      doc.contentText,
      docId,
      doc.fileName,
    );

    this.logger.log(`STUDY_PLAN_DEBUG | generated plan title="${plan.title}" modules=${plan.modules.length}`);
    this.logger.log(`STUDY_PLAN_DEBUG | plan overview: ${plan.overview}`);

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
    const messages = await this.chatRepository.find({
      where: {
        document: { id: docId },
        user: { id: userId },
      },
      relations: ['document'],
      order: { createdAt: 'ASC' },
    });

    let firstUserMsgFound = false;

    return messages.map(msg => {
      let attachmentName: string | null = null;
      if (msg.messageType === 'QA' && msg.question && !firstUserMsgFound) {
        firstUserMsgFound = true;
        attachmentName = msg.document?.fileName || null;
      }
      return {
        ...msg,
        attachmentName,
      };
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
      imageMimeType: message.imageMimeType ?? null,
      imageOriginalName: message.imageOriginalName ?? null,
      attachmentName: null,
      createdAt: message.createdAt,
    };
  }

  async hasConversationImages(conversationId: string): Promise<boolean> {
    const count = await this.chatRepository
      .createQueryBuilder('msg')
      .where('msg.conversation_id = :conversationId', { conversationId })
      .andWhere('msg.image_data IS NOT NULL')
      .getCount();
    return count > 0;
  }

  async getConversationMessagesRaw(conversationId: string, userId: string): Promise<ChatMessage[]> {
    return await this.chatRepository.find({
      where: {
        conversation: { id: conversationId },
        user: { id: userId },
      },
      order: { createdAt: 'ASC' },
    });
  }
}
