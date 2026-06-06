import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Get,
  UseGuards,
  Request,
  Delete,
  Param,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { DocumentsService } from './documents.service';
import { AIService } from '../common/services/ai.service';
import type { UploadedFile as UploadedPdfFile } from '../common/types/uploaded-file.type';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type';
import { DOCUMENT_MESSAGES } from '../common/constants/messages';
import { RagService } from '../modules/rag/rag.service';

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

function isStudyPlanRequest(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('study plan') ||
    lower.includes('roadmap') ||
    lower.includes('learning path')
  );
}

@Controller('documents')
@UseGuards(AuthGuard('jwt'))
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly aiService: AIService,
    private readonly ragService: RagService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: UploadedPdfFile,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return await this.documentsService.create(file, userId);
  }

  @Get()
  async findAll(@Request() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    return await this.documentsService.findAllByUser(userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    return await this.documentsService.remove(id, userId);
  }

  @Post(':id/chat')
  async chatWithDoc(
    @Param('id') id: string,
    @Body('question') question: string,
    @Body('conversationId') conversationId: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;

    const docIdsRaw = conversationId ? await this.documentsService.getConversationDocumentIds(conversationId) : [];
    const allDocIds = Array.from(new Set([...docIdsRaw, id]));

    const docs = await Promise.all(allDocIds.map(docId => 
      this.documentsService.findOne(docId, userId).catch(() => null)
    ));
    const validDocs = docs.filter(d => d !== null && d.contentText && d.contentText.trim().length > 0);

    if (validDocs.length === 0) {
      throw new BadRequestException(
        DOCUMENT_MESSAGES.DOCUMENT_NOT_READY_FOR_CHAT,
      );
    }

    const preComputedSummaries = validDocs.map(d => d!.summary).filter((s): s is string => !!s);
    
    let answer = '';
    let artifactType: 'QUIZ' | 'STUDY_PLAN' | 'FLASHCARDS' | 'MINDMAP' | null = null;
    let artifactData: any = null;
    
    const combinedText = validDocs.map(d => d!.contentText).join('\n\n').substring(0, 25000);

    if (isStudyPlanRequest(question)) {
      artifactType = 'STUDY_PLAN';
      artifactData = await this.documentsService.createAndSaveStudyPlan(userId, id);
      answer = 'Study plan is ready.';
    } else if (isQuizRequest(question)) {
      artifactType = 'QUIZ';
      artifactData = await this.aiService.generateQuiz(combinedText);
      answer = 'Quiz is created done.';
    } else if (isFlashcardRequest(question)) {
      artifactType = 'FLASHCARDS';
      artifactData = await this.aiService.generateFlashcards(combinedText);
      answer = 'Flashcard is created done.';
    } else {
      const ragResult = await this.ragService.answerQuestion(question, userId, allDocIds, preComputedSummaries);
      answer = ragResult.answer;

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
        artifactData = await this.documentsService.createAndSaveStudyPlan(userId, id);
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

    const savedMessage = await this.documentsService.saveMessage(userId, id, question, cleanAnswer, conversationId);

    if (artifactType && artifactData) {
      await this.documentsService.saveArtifactMessage(
        userId,
        id,
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
      conversationId: savedMessage.conversation?.id,
      messageId: savedMessage.id,
      answer: displayAnswer,
      artifactType,
      artifactData,
    };
  }

  @Post(':id/history/artifact')
  async saveArtifactToHistory(
    @Param('id') id: string,
    @Body()
    body: {
      artifactType: 'QUIZ' | 'STUDY_PLAN';
      artifact: unknown;
      note?: string;
    },
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;

    if (!body?.artifactType || !body?.artifact) {
      throw new BadRequestException(DOCUMENT_MESSAGES.ARTIFACT_REQUIRED);
    }

    await this.documentsService.findOne(id, userId);

    return await this.documentsService.saveArtifactMessage(
      userId,
      id,
      body.artifactType,
      body.artifact,
      body.note,
    );
  }

  @Post(':id/study-plan')
  async generateStudyPlan(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    const plan = await this.documentsService.createAndSaveStudyPlan(userId, id);
    return { studyPlan: plan };
  }

  @Post(':id/mindmap')
  async generateMindMap(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    const doc = await this.documentsService.findOne(id, userId);

    if (!doc.contentText || doc.contentText.trim().length === 0) {
      throw new BadRequestException('Document text is empty or not parsed yet.');
    }

    const nodes = await this.aiService.generateMindMap(doc.contentText);
    return { nodes };
  }

  @Get(':id/history')
  async getHistory(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return await this.documentsService.getChatHistory(id, userId);
  }
}
