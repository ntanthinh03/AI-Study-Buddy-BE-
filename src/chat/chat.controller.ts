import {
  Body,
  Get,
  UploadedFile,
  Controller,
  Param,
  Post,
  Request,
  UseInterceptors,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ChatService } from './chat.service';
import { DocumentsService } from '../documents/documents.service';
import { RagService } from '../modules/rag/rag.service';
import { AIService } from '../common/services/ai.service';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type';
import type { UploadedFile as UploadedChatImage } from '../common/types/uploaded-file.type';
import { CHAT_MESSAGES } from '../common/constants/messages';

function isQuizRequest(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('quiz') ||
    lower.includes('question') ||
    lower.includes('mcq') ||
    lower.includes('test me') ||
    lower.includes('practice')
  );
}

function isFlashcardRequest(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('flashcard') ||
    lower.includes('card')
  );
}

@Controller('chat')
@UseGuards(AuthGuard('jwt'))
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly documentsService: DocumentsService,
    private readonly ragService: RagService,
    private readonly aiService: AIService,
  ) {}

  @Post('ask')
  async askAI(
    @Body()
    body: {
      message: string;
      conversationId?: string;
      title?: string;
    },
    @Request() req: AuthenticatedRequest,
  ) {
    if (!body?.message || body.message.trim().length === 0) {
      throw new BadRequestException(CHAT_MESSAGES.MESSAGE_REQUIRED);
    }

    const userId = req.user.userId;

    const docIds = body.conversationId
      ? await this.documentsService.getAllConversationDocumentIds(body.conversationId, userId)
      : [];

    if (docIds.length === 0) {
      const promptToUpload = 'Hello! To start studying, please attach or upload at least one relevant PDF/image document to this conversation. I will read all the uploaded materials to answer your questions, help you generate multiple-choice quizzes, study flashcards, or create a study plan tailored strictly to the document content!';
      return await this.documentsService.saveGeneralMessage(
        userId,
        body.message,
        promptToUpload,
        body.conversationId,
        body.title,
      );
    }

    const docs = await Promise.all(docIds.map(docId => 
      this.documentsService.findOne(docId, userId).catch(() => null)
    ));
    const validDocs = docs.filter(d => d !== null && d.contentText && d.contentText.trim().length > 0);

    if (validDocs.length === 0) {
      throw new BadRequestException('Learning materials are being processed, please wait a moment.');
    }

    const preComputedSummaries = validDocs.map(d => d!.summary).filter((s): s is string => !!s);
    
    let answer = '';
    let artifactType: 'QUIZ' | 'STUDY_PLAN' | 'FLASHCARDS' | 'MINDMAP' | null = null;
    let artifactData: any = null;
    
    const combinedText = validDocs.map(d => d!.contentText).join('\n\n').substring(0, 25000);

    if (isQuizRequest(body.message)) {
      artifactType = 'QUIZ';
      artifactData = await this.aiService.generateQuiz(combinedText);
      answer = 'Quiz is created done.';
    } else if (isFlashcardRequest(body.message)) {
      artifactType = 'FLASHCARDS';
      artifactData = await this.aiService.generateFlashcards(combinedText);
      answer = 'Flashcard is created done.';
    } else {
      const { answer: rawAnswer } = await this.ragService.answerQuestion(body.message, userId, docIds, preComputedSummaries);
      answer = rawAnswer;

      if (answer.includes('[GENERATE_QUIZ]')) {
        artifactType = 'QUIZ';
        artifactData = await this.aiService.generateQuiz(combinedText);
        answer = 'Quiz is created done.';
      } else if (answer.includes('[GENERATE_FLASHCARDS]')) {
        artifactType = 'FLASHCARDS';
        artifactData = await this.aiService.generateFlashcards(combinedText);
        answer = 'Flashcard is created done.';
      } else if (answer.includes('[GENERATE_MINDMAP]')) {
        artifactType = 'MINDMAP';
        artifactData = await this.aiService.generateMindMap(combinedText);
      } else if (answer.includes('[GENERATE_STUDY_PLAN]')) {
        artifactType = 'STUDY_PLAN';
        artifactData = await this.documentsService.createAndSaveStudyPlan(userId, docIds[0]);
      }
    }

    const cleanAnswer = answer
      .replace('[GENERATE_QUIZ]', '')
      .replace('[GENERATE_FLASHCARDS]', '')
      .replace('[GENERATE_MINDMAP]', '')
      .replace('[GENERATE_STUDY_PLAN]', '')
      .trim();
    const displayAnswer = artifactType === 'STUDY_PLAN'
      ? 'Study plan is ready.'
      : cleanAnswer;

    const savedMessage = await this.documentsService.saveGeneralMessage(
      userId,
      body.message,
      displayAnswer,
      body.conversationId,
      body.title,
    );

    if (artifactType && artifactData) {
      await this.documentsService.saveArtifactMessage(
        userId,
        docIds[0],
        artifactType,
        artifactData,
        artifactType === 'STUDY_PLAN'
          ? 'Study plan is ready.'
          : artifactType === 'QUIZ'
          ? 'Quiz is ready.'
          : artifactType === 'FLASHCARDS'
          ? 'Flashcards are ready.'
          : artifactType === 'MINDMAP'
          ? 'Mind map is ready.'
          : `Generated ${artifactType.toLowerCase()} from chat request`,
      );
    }

    return {
      conversationId: savedMessage.conversationId,
      messageId: savedMessage.messageId,
      question: savedMessage.question,
      answer: displayAnswer,
      createdAt: savedMessage.createdAt,
      artifactType,
      artifactData,
    };
  }

  @Post('ask-image')
  @UseInterceptors(FileInterceptor('image'))
  async askAIWithImage(
    @UploadedFile() file: UploadedChatImage,
    @Body()
    body: {
      question?: string;
      message?: string;
      conversationId?: string;
      title?: string;
    },
    @Request() req: AuthenticatedRequest,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException(CHAT_MESSAGES.IMAGE_REQUIRED);
    }

    const mimeType = file.mimetype ?? '';
    if (!mimeType.startsWith('image/')) {
      throw new BadRequestException(CHAT_MESSAGES.ONLY_IMAGE_FILES_SUPPORTED);
    }

    const question = (body.question ?? body.message ?? '').trim();
    if (!question) {
      throw new BadRequestException(CHAT_MESSAGES.QUESTION_REQUIRED);
    }

    const answer = await this.chatService.getAIImageResponse(
      question,
      file.buffer,
      mimeType,
    );

    return await this.documentsService.saveGeneralMessage(
      req.user.userId,
      question,
      answer,
      body.conversationId,
      body.title,
      {
        data: file.buffer,
        mimeType,
        originalName: file.originalname ?? 'image',
      },
    );
  }

  @Get('messages/:messageId/image')
  async getMessageImage(
    @Param('messageId') messageId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return await this.documentsService.getGeneralMessageImage(
      req.user.userId,
      messageId,
    );
  }
}
