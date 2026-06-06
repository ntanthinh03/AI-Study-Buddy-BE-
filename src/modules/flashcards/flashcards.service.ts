import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Flashcard } from './entities/flashcard.entity';
import { Document } from '../../documents/entities/document.entity';
import { User } from '../../users/entities/user.entity';
import { AIService } from '../../common/services/ai.service';
import { Cron } from '@nestjs/schedule';
import { AnalyticsService } from '../analytics/analytics.service';
import { ActivityType } from '../analytics/entities/study-activity.entity';

@Injectable()
export class FlashcardsService {
  private readonly logger = new Logger(FlashcardsService.name);

  constructor(
    @InjectRepository(Flashcard)
    private readonly flashcardRepository: Repository<Flashcard>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly aiService: AIService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async generateFlashcards(documentId: string, user: User): Promise<Flashcard[]> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, user: { id: user.id } },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const context = document.contentText || document.summary || '';
    if (!context) {
      throw new Error('Document has no content to generate flashcards');
    }

    this.logger.log(`Generating flashcards for document: ${documentId}`);

    const flashcardsData = await this.aiService.generateFlashcards(context);

    const flashcards = flashcardsData
      .filter((data: any) => data && data.front && data.back)
      .map((data: any) => {
        const flashcard = new Flashcard();
        flashcard.front = data.front;
        flashcard.back = data.back;
        flashcard.user = user;
        flashcard.document = document;
        flashcard.nextReview = new Date();
        return flashcard;
      });

    return await this.flashcardRepository.save(flashcards);
  }

  async generateFlashcardsByTopic(documentId: string, topic: string, user: User): Promise<Flashcard[]> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, user: { id: user.id } },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const context = document.contentText || document.summary || '';
    if (!context) {
      throw new Error('Document has no content to generate flashcards');
    }

    this.logger.log(`Generating flashcards for topic "${topic}" in document: ${documentId}`);

    let flashcardsData: any[];
    try {
      flashcardsData = await this.aiService.generateFlashcardsByTopic(context, topic);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Topic flashcard generation failed for topic "${topic}", falling back to generic flashcards: ${message}`,
      );
      flashcardsData = await this.aiService.generateFlashcards(context);
    }

    const flashcards = flashcardsData
      .filter((data: any) => data && data.front && data.back)
      .map((data: any) => {
        const flashcard = new Flashcard();
        flashcard.front = data.front;
        flashcard.back = data.back;
        flashcard.user = user;
        flashcard.document = document;
        flashcard.nextReview = new Date();
        return flashcard;
      });

    return await this.flashcardRepository.save(flashcards);
  }

  async getFlashcardsByUser(user: User): Promise<Flashcard[]> {
    return await this.flashcardRepository.find({
      where: { user: { id: user.id } },
      relations: ['document'],
      order: { createdAt: 'DESC' },
    });
  }

  async getFlashcardsToReview(user: User): Promise<Flashcard[]> {
    const now = new Date();
    return await this.flashcardRepository.createQueryBuilder('flashcard')
      .where('flashcard.user_id = :userId', { userId: user.id })
      .andWhere('flashcard.next_review <= :now', { now })
      .leftJoinAndSelect('flashcard.document', 'document')
      .getMany();
  }

  async updateReviewStatus(flashcardId: string, isCorrect: boolean, user: User): Promise<Flashcard> {
    const flashcard = await this.flashcardRepository.findOne({
      where: { id: flashcardId, user: { id: user.id } },
    });

    if (!flashcard) {
      throw new NotFoundException('Flashcard not found');
    }

    if (isCorrect) {
      flashcard.box += 1;
    } else {
      flashcard.box = 0;
    }

    const daysToAdd = Math.pow(2, flashcard.box);
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + daysToAdd);
    flashcard.nextReview = nextReview;

    const saved = await this.flashcardRepository.save(flashcard);

    await this.analyticsService.logActivity(user, ActivityType.FLASHCARD, {
      totalQuestions: 1,
      correctAnswers: isCorrect ? 1 : 0,
      metadata: { flashcardId: saved.id, documentId: saved.document?.id },
    });

    return saved;
  }

  async createManualFlashcard(front: string, back: string, user: User): Promise<Flashcard> {
    const flashcard = new Flashcard();
    flashcard.front = front;
    flashcard.back = back;
    flashcard.user = user;
    flashcard.nextReview = new Date();
    return await this.flashcardRepository.save(flashcard);
  }

  @Cron('0 9 * * *')
  async handleDailyReminder() {
    this.logger.log('Running daily study reminder CronJob...');
  }
}
