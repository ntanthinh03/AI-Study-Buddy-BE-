import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Flashcard } from './entities/flashcard.entity';
import { Document } from '../../documents/entities/document.entity';
import { User } from '../../users/entities/user.entity';
import { ChatOllama } from '@langchain/ollama';
import { AI_PROMPTS } from '../../common/constants/ai-prompts';
import { ConfigService } from '@nestjs/config';
import { normalizeOllamaBaseUrl } from '../../common/config/ollama.config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AnalyticsService } from '../analytics/analytics.service';
import { ActivityType } from '../analytics/entities/study-activity.entity';

@Injectable()
export class FlashcardsService {
  private readonly logger = new Logger(FlashcardsService.name);
  private model: ChatOllama;

  constructor(
    @InjectRepository(Flashcard)
    private readonly flashcardRepository: Repository<Flashcard>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly configService: ConfigService,
    private readonly analyticsService: AnalyticsService,
  ) {
    const baseUrl = normalizeOllamaBaseUrl(
      this.configService.get<string>('OLLAMA_BASE_URL'),
    );
    this.model = new ChatOllama({
      baseUrl,
      model: this.configService.get<string>('OLLAMA_TEXT_MODEL') ?? 'phi3:medium-128k',
      temperature: 0.3,
      format: 'json',
    });
  }

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

    const response = await this.model.invoke([
      { role: 'system', content: AI_PROMPTS.FLASHCARD_SYSTEM },
      { role: 'user', content: AI_PROMPTS.FLASHCARD_USER(context) },
    ]);

    let content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    this.logger.debug(`AI Raw Response: ${content}`);
    
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let flashcardsData: any;
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      const jsonToParse = jsonMatch ? jsonMatch[0] : content;
      flashcardsData = JSON.parse(jsonToParse);
    } catch (e) {
      this.logger.error(`Failed to parse AI response: ${content}`);
      throw new Error('Failed to parse flashcards data from AI');
    }

    if (!Array.isArray(flashcardsData)) {
      if (flashcardsData && typeof flashcardsData === 'object' && flashcardsData.flashcards && Array.isArray(flashcardsData.flashcards)) {
        flashcardsData = flashcardsData.flashcards;
      } else if (flashcardsData && typeof flashcardsData === 'object' && flashcardsData.data && Array.isArray(flashcardsData.data)) {
        flashcardsData = flashcardsData.data;
      } else {
        this.logger.error(`AI response is not an array: ${JSON.stringify(flashcardsData)}`);
        throw new Error('AI generated invalid flashcards format');
      }
    }

    const flashcards = flashcardsData.map((data: any) => {
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

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleDailyReminder() {
    this.logger.log('Running daily study reminder CronJob...');
  }
}
