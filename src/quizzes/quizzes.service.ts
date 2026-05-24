import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quiz } from './entities/quiz.entity';
import { DocumentsService } from '../documents/documents.service';
import { AIService, type QuizQuestion } from '../common/services/ai.service';
import { QUIZ_MESSAGES } from '../common/constants/messages';
import { AnalyticsService } from '../modules/analytics/analytics.service';
import { ActivityType } from '../modules/analytics/entities/study-activity.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class QuizzesService {
  constructor(
    @InjectRepository(Quiz)
    private quizzesRepository: Repository<Quiz>,
    private readonly documentsService: DocumentsService,
    private readonly aiService: AIService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async generateQuiz(
    documentId: string,
    userId: string,
    quizNameFromFe?: string,
    quizTitleFromFe?: string,
  ) {
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

    const quizName =
      quizNameFromFe?.trim() || this.buildQuizName(document.fileName);
    const quizTitle =
      quizTitleFromFe?.trim() || this.buildQuizTitle(document.fileName);

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

    const quiz = await this.saveQuiz(
      questions,
      documentId,
      userId,
      conversationId,
      quizName,
      quizTitle,
    );

    return {
      quizId: quiz.id,
      quizName: quiz.quizName,
      quizTitle: quiz.quizTitle,
      conversationId,
      questions,
    };
  }

  async generateMoreQuestions(quizId: string, userId: string) {
    const quiz = await this.quizzesRepository.findOne({
      where: { id: quizId, user: { id: userId } },
      relations: ['document'],
    });

    if (!quiz) {
      throw new Error('Quiz not found');
    }

    const document = quiz.document;
    if (!document) {
      throw new Error('No document associated with this quiz.');
    }

    if (!document.contentText || document.contentText.trim().length === 0) {
      throw new Error('Document has no extractable text for progressive generation.');
    }

    const existingQuestions = quiz.questions || [];
    if (existingQuestions.length >= 20) {
      return {
        quizId,
        questions: existingQuestions,
        completed: true,
      };
    }

    const nextQuestions = await this.aiService.generateMoreQuizQuestions(
      document.contentText,
      existingQuestions,
    );

    if (!nextQuestions || nextQuestions.length === 0) {
      return {
        quizId,
        questions: existingQuestions,
        completed: true,
      };
    }

    const updatedQuestions = [...existingQuestions, ...nextQuestions];
    const finalQuestions = updatedQuestions.slice(0, 20);

    quiz.questions = finalQuestions;
    await this.quizzesRepository.save(quiz);

    return {
      quizId,
      questions: finalQuestions,
      completed: finalQuestions.length >= 20 || nextQuestions.length < 5,
    };
  }

  async saveFeQuiz(
    userId: string,
    documentId: string,
    questions: QuizQuestion[],
    quizName?: string,
    quizTitle?: string,
  ) {
    const artifactMessage = await this.documentsService.saveArtifactMessage(
      userId,
      documentId,
      'QUIZ',
      questions,
      'User generated quiz',
    );

    const conversationId = artifactMessage.conversation?.id;
    if (!conversationId) {
      throw new Error('Failed to bind quiz to conversation.');
    }

    const quiz = await this.saveQuiz(
      questions,
      documentId,
      userId,
      conversationId,
      quizName || 'FE Generated Quiz',
      quizTitle || 'Quiz',
    );

    return {
      quizId: quiz.id,
      quizName: quiz.quizName,
      quizTitle: quiz.quizTitle,
      conversationId,
      questions,
    };
  }

  async saveQuiz(

    questions: QuizQuestion[],
    documentId: string,
    userId: string,
    conversationId: string,
    quizName: string,
    quizTitle: string,
  ) {
    const quiz = this.quizzesRepository.create({
      quizName,
      quizTitle,
      questions,
      document: { id: documentId },
      user: { id: userId },
      conversation: { id: conversationId },
    });
    return await this.quizzesRepository.save(quiz);
  }
  async findAllByUser(userId: string) {
    const quizzes = await this.quizzesRepository.find({
      where: { user: { id: userId } },
      relations: ['document', 'conversation'],
      order: { createdAt: 'DESC' },
    });

    return quizzes.map((quiz) => this.formatQuizResponse(quiz));
  }

  private buildQuizName(fileName: string) {
    const baseName = fileName.trim().replace(/\.[^.]+$/, '');
    return `Quiz - ${baseName}`;
  }

  private buildQuizTitle(fileName: string) {
    const baseName = fileName.trim().replace(/\.[^.]+$/, '');
    return `${baseName} Quiz`;
  }

  private formatQuizResponse(quiz: Quiz) {
    return {
      quizId: quiz.id,
      quizName: quiz.quizName,
      quizTitle: quiz.quizTitle,
      documentId: quiz.document?.id ?? null,
      conversationId: quiz.conversation?.id ?? null,
      questions: quiz.questions,
      createdAt: quiz.createdAt,
    };
  }

  async submitQuizResult(
    user: User,
    data: {
      quizId: string;
      score: number;
      totalQuestions: number;
      correctAnswers: number;
      durationSeconds?: number;
    },
  ) {
    const userId = (user as any).userId || user.id;
    const quiz = await this.quizzesRepository.findOne({
      where: { id: data.quizId, user: { id: userId } },
      relations: ['document'],
    });

    return await this.analyticsService.logActivity({ id: userId } as any, ActivityType.QUIZ, {
      score: data.score,
      totalQuestions: data.totalQuestions,
      correctAnswers: data.correctAnswers,
      durationSeconds: data.durationSeconds,
      metadata: { quizId: data.quizId, documentId: quiz?.document?.id },
    });
  }
}
