import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quiz } from './entities/quiz.entity';
import { DocumentsService } from '../documents/documents.service';
import { AIService, type QuizQuestion } from '../documents/ai.service';
import { QUIZ_MESSAGES } from '../common/constants/messages';

@Injectable()
export class QuizzesService {
  constructor(
    @InjectRepository(Quiz)
    private quizzesRepository: Repository<Quiz>,
    private readonly documentsService: DocumentsService,
    private readonly aiService: AIService,
  ) {}

  async generateQuiz(documentId: string, userId: string) {
    const document = await this.documentsService.findOne(documentId, userId);

    if (!document) {
      throw new Error(QUIZ_MESSAGES.DOCUMENT_NOT_FOUND);
    }

    if (document.status === 'PROCESSING') {
      throw new Error(QUIZ_MESSAGES.DOCUMENT_STILL_PROCESSING);
    }

    if (!document.contentText || document.contentText.trim().length === 0) {
      throw new Error(QUIZ_MESSAGES.DOCUMENT_NO_EXTRACTABLE_TEXT);
    }

    const questions = await this.aiService.generateQuiz(document.contentText);

    const artifactMessage = await this.documentsService.saveArtifactMessage(
      userId,
      documentId,
      'QUIZ',
      questions,
      'Generated quiz',
    );

    const conversationId = artifactMessage.conversation?.id;
    if (!conversationId) {
      throw new Error('Failed to bind quiz to conversation.');
    }

    const quiz = await this.saveQuiz(questions, documentId, userId, conversationId);

    return {
      quizId: quiz.id,
      conversationId,
      questions,
    };
  }
  async saveQuiz(
    questions: QuizQuestion[],
    documentId: string,
    userId: string,
    conversationId: string,
  ) {
    const quiz = this.quizzesRepository.create({
      questions,
      document: { id: documentId },
      user: { id: userId },
      conversation: { id: conversationId },
    });
    return await this.quizzesRepository.save(quiz);
  }
  async findAllByUser(userId: string) {
    return await this.quizzesRepository.find({
      where: { user: { id: userId } },
      relations: ['document', 'conversation'],
      order: { createdAt: 'DESC' },
    });
  }
}
