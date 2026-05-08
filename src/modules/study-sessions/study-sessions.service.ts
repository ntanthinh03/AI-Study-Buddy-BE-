import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { StudySession, SessionStatus } from './entities/study-session.entity';
import { QuestionPool, QuestionType } from './entities/question-pool.entity';
import { UserStats } from '../../users/entities/user-stats.entity';
import { User } from '../../users/entities/user.entity';
import { AIService } from '../../common/services/ai.service';
import { Document } from '../../documents/entities/document.entity';
import { Flashcard } from '../flashcards/entities/flashcard.entity';
import { AnalyticsService } from '../analytics/analytics.service';
import { ActivityType } from '../analytics/entities/study-activity.entity';

@Injectable()
export class StudySessionsService {
  private readonly logger = new Logger(StudySessionsService.name);

  constructor(
    @InjectRepository(StudySession)
    private readonly sessionRepository: Repository<StudySession>,
    @InjectRepository(QuestionPool)
    private readonly poolRepository: Repository<QuestionPool>,
    @InjectRepository(UserStats)
    private readonly statsRepository: Repository<UserStats>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(Flashcard)
    private readonly flashcardRepository: Repository<Flashcard>,
    private readonly aiService: AIService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async getOrCreateDailySession(user: any): Promise<StudySession> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const userId = user?.userId ?? user?.id ?? user;

    let session = await this.sessionRepository.findOne({
      where: {
        user: { id: userId },
        createdAt: MoreThanOrEqual(today),
      },
      order: { createdAt: 'DESC' },
    });

    if (session) return session;

    const poolQuizzes = await this.poolRepository.find({
      where: { user: { id: userId }, type: QuestionType.QUIZ, isUsed: false },
      take: 5,
    });

    const dueFlashcards = await this.flashcardRepository.find({
      where: {
        user: { id: userId },
        nextReview: MoreThanOrEqual(new Date(0)),
      },
      take: 5,
    });

    session = this.sessionRepository.create({
      user: { id: userId },
      content: {
        quizQuestions: poolQuizzes.map(p => ({ ...p.data, poolId: p.id })),
        flashcards: dueFlashcards.map(f => ({
          id: f.id,
          front: f.front,
          back: f.back,
          box: f.box,
          next_review: f.nextReview ? f.nextReview.toISOString() : null,
          document_id: f.document ? (f.document as any).id : null,
          created_at: f.createdAt ? f.createdAt.toISOString() : new Date().toISOString(),
          updated_at: f.updatedAt ? f.updatedAt.toISOString() : new Date().toISOString(),
        })),
      },
      status: SessionStatus.IN_PROGRESS,
    });

    return await this.sessionRepository.save(session);
  }

  async generateMockExam(user: any, questionCount: number = 20, documentId?: string): Promise<StudySession> {
    const userId = user?.userId ?? user?.id ?? user;
    this.logger.log(`Mock Exam Request: userId=${userId}, count=${questionCount}, documentId=${documentId}`);
    
    let questionsData: any[] = [];

    if (documentId) {
      const document = await this.documentRepository.findOne({
        where: { id: documentId, user: { id: userId } }
      });
      if (!document) throw new NotFoundException('Document not found');

      this.logger.log(`Generating ephemeral mock exam from document: ${document.fileName}`);
      this.logger.log(`Document Content Length: ${document.contentText?.length || 0}`);
      this.logger.log(`Document Content Snippet: ${document.contentText?.substring(0, 200)}...`);
      
      // Thử đợt 1: Tạo 10 câu trắc nghiệm
      let questions = await this.aiService.generateQuiz(document.contentText || '');
      
      // Nếu đợt 1 thất bại hoàn toàn, thử lại một lần nữa
      if (questions.length === 0) {
        this.logger.warn(`AI failed first attempt for document ${documentId}, retrying...`);
        questions = await this.aiService.generateQuiz(document.contentText || '');
      }

      // Thử tạo thêm một đợt nữa để đủ số lượng
      if (questions.length < 15) {
        const extra = await this.aiService.generateQuiz(document.contentText || '');
        questions = [...questions, ...extra];
      }

      if (questions.length === 0) {
        this.logger.error(`AI failed to generate any questions for document ${documentId} after retries`);
        throw new Error('AI failed to generate questions for this document. The content might be too complex or short.');
      }

      // Gán poolId là null vì đây là câu hỏi tạm thời
      questionsData = questions.map(q => ({ 
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        poolId: null 
      }));
    } else {
      const poolQuizzes = await this.poolRepository.createQueryBuilder('pool')
        .where('pool.user_id = :userId', { userId })
        .andWhere('pool.type = :type', { type: QuestionType.QUIZ })
        .orderBy('RANDOM()')
        .take(questionCount)
        .getMany();

      if (poolQuizzes.length === 0) {
        throw new NotFoundException('Not enough questions in pool to generate a mock exam. Please select a document or generate more quizzes first.');
      }
      questionsData = poolQuizzes.map(p => ({ ...p.data, poolId: p.id }));
    }

    const session = this.sessionRepository.create({
      user: { id: userId },
      content: {
        quizQuestions: questionsData,
        flashcards: [],
      },
      status: SessionStatus.IN_PROGRESS,
    });

    return await this.sessionRepository.save(session);
  }

  async submitSessionResult(
    user: any,
    sessionId: string,
    result: { correctAnswers: number; totalQuestions: number },
  ): Promise<UserStats> {
    const userId = user?.userId ?? user?.id ?? user;

    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, user: { id: userId } },
    });

    if (!session || session.status === SessionStatus.COMPLETED) {
      throw new NotFoundException('Session not found or already completed');
    }

    const poolIds = session.content.quizQuestions
      .filter(q => q.poolId)
      .map(q => q.poolId);
    if (poolIds.length > 0) {
      await this.poolRepository
        .createQueryBuilder()
        .update()
        .set({ isUsed: true })
        .whereInIds(poolIds)
        .execute();
    }

    const xpEarned = result.correctAnswers * 10 + 20;
    session.status = SessionStatus.COMPLETED;
    session.xpEarned = xpEarned;
    session.correctAnswers = result.correctAnswers;
    session.completedAt = new Date();
    await this.sessionRepository.save(session);

    let stats = await this.statsRepository.findOne({ where: { user: { id: userId } } });
    if (!stats) {
      stats = this.statsRepository.create({
        user: { id: userId },
        totalXP: 0,
        currentStreak: 0,
        longestStreak: 0,
        level: 1,
        totalFocusTime: 0,
        lastStudyDate: null,
      });
    }

    const lastStudy = stats.lastStudyDate;
    const now = new Date();
    const isConsecutive = lastStudy && this.isNextDay(lastStudy, now);
    const isSameDay = lastStudy && this.isSameDay(lastStudy, now);

    if (!isSameDay) {
      if (isConsecutive || !lastStudy) {
        stats.currentStreak = (stats.currentStreak || 0) + 1;
      } else {
        stats.currentStreak = 1;
      }
      stats.lastStudyDate = now;
    }

    if (stats.currentStreak > stats.longestStreak) {
      stats.longestStreak = stats.currentStreak;
    }

    stats.totalXP = (stats.totalXP || 0) + xpEarned;
    stats.level = Math.floor(stats.totalXP / 1000) + 1;

    // LOG TO ANALYTICS
    await this.analyticsService.logActivity({ id: userId } as any, ActivityType.QUIZ, {
      score: (result.correctAnswers * 100) / (result.totalQuestions || 1),
      totalQuestions: result.totalQuestions,
      correctAnswers: result.correctAnswers,
      metadata: { sessionId, type: 'STUDY_SESSION' }
    });

    return await this.statsRepository.save(stats);
  }

  async generateBatchForDocument(user: User, documentId: string) {
    const userId = (user as any)?.userId ?? (user as any)?.id ?? user;
    const document = await this.documentRepository.findOne({
      where: { id: documentId, user: { id: userId } },
    });

    if (!document) throw new NotFoundException('Document not found');

    this.logger.log(`Generating batch questions for document: ${documentId}`);
    const { quizzes, flashcards } = await this.aiService.generateBatchQuestions(
      document.contentText || '',
    );

    const poolItems = [
      ...quizzes.map(q => this.poolRepository.create({
        user: { id: userId },
        document,
        type: QuestionType.QUIZ,
        data: q,
      })),
      ...flashcards.map(f => this.poolRepository.create({
        user: { id: userId },
        document,
        type: QuestionType.FLASHCARD,
        data: f,
      })),
    ];

    await this.poolRepository.save(poolItems);
    return { quizCount: quizzes.length, flashcardCount: flashcards.length };
  }

  async getUserStats(user: any): Promise<UserStats> {
    const userId = user?.userId ?? user?.id ?? user;
    let stats = await this.statsRepository.findOne({ where: { user: { id: userId } } });
    if (!stats) {
      stats = this.statsRepository.create({ user: { id: userId } });
      await this.statsRepository.save(stats);
    }
    return stats;
  }

  async getLeaderboard(): Promise<any[]> {
    const statsList = await this.statsRepository.find({
      relations: ['user'],
      order: { totalXP: 'DESC' },
      take: 50,
    });

    return statsList.map((stat, index) => ({
      id: stat.user?.id || 'unknown',
      name: stat.user?.email?.split('@')?.[0] || 'Scholar',
      avatar: stat.user?.avatar || null,
      xp: stat.totalXP,
      level: stat.level,
      rank: index + 1,
    }));
  }

  async submitFocusSession(user: any, minutes: number): Promise<UserStats> {
    const userId = user?.userId ?? user?.id ?? user;
    let stats = await this.statsRepository.findOne({ where: { user: { id: userId } } });
    if (!stats) {
      stats = this.statsRepository.create({ user: { id: userId } });
    }

    stats.totalFocusTime += minutes;
    
    const xpEarned = Math.floor((minutes / 25) * 20) + (minutes % 25 > 10 ? 5 : 0);
    if (xpEarned > 0) {
      stats.totalXP += xpEarned;
      stats.level = Math.floor(stats.totalXP / 1000) + 1;
      
      const lastStudy = stats.lastStudyDate;
      const now = new Date();
      const isConsecutive = lastStudy && this.isNextDay(lastStudy, now);
      const isSameDay = lastStudy && this.isSameDay(lastStudy, now);

      if (!isSameDay) {
        if (isConsecutive || !lastStudy) {
          stats.currentStreak += 1;
        } else {
          stats.currentStreak = 1;
        }
        stats.lastStudyDate = now;
      }

      if (stats.currentStreak > stats.longestStreak) {
        stats.longestStreak = stats.currentStreak;
      }

      // LOG TO ANALYTICS
      await this.analyticsService.logActivity({ id: userId } as any, ActivityType.FLASHCARD, {
        score: 100,
        durationSeconds: minutes * 60,
        metadata: { minutes, type: 'FOCUS_SESSION' }
      });
    }

    return await this.statsRepository.save(stats);
  }

  private isNextDay(last: Date, now: Date): boolean {
    const nextDay = new Date(last);
    nextDay.setDate(nextDay.getDate() + 1);
    return this.isSameDay(nextDay, now);
  }

  private isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();
  }
}
