import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MindMap } from './entities/mind-map.entity';
import { Document } from '../../documents/entities/document.entity';
import { AIService } from '../../common/services/ai.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { ActivityType } from '../analytics/entities/study-activity.entity';

@Injectable()
export class MindMapsService {
  private readonly logger = new Logger(MindMapsService.name);

  constructor(
    @InjectRepository(MindMap)
    private mindMapRepository: Repository<MindMap>,
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    private aiService: AIService,
    private analyticsService: AnalyticsService,
  ) {}

  async generateAndSave(userId: string, documentId: string, text: string) {
    try {
      this.logger.log(`Generating mind map for user ${userId}, doc ${documentId}`);

      let textToUse = text;
      if (documentId) {
        const doc = await this.documentRepository.findOne({
          where: { id: documentId },
        });
        if (doc && (doc.contentText || doc.summary)) {
          textToUse = doc.contentText || doc.summary || text;
        }
      }

      const mindMapData = await this.aiService.generateMindMap(textToUse);
      
      const title = await this.aiService.generateSmartTitle(textToUse, 'Mind Map');

      
      const mindMapDataToInsert = {
        userId,
        documentId,
        title,
        content: mindMapData,
      };
      const insertResult = await this.mindMapRepository.insert(mindMapDataToInsert);
      const saved = {
        id: insertResult.identifiers[0].id,
        ...mindMapDataToInsert,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as MindMap;

      await this.analyticsService.logActivity(
        { id: userId } as any,
        ActivityType.DOCUMENT_READ,
        {
          score: 0,
          totalQuestions: 0,
          correctAnswers: 0,
          metadata: { mindMapId: saved.id, title: saved.title },
        },
      );

      return saved;
    } catch (error) {
      this.logger.error(`Failed to generate mind map: ${error.message}`);
      throw new InternalServerErrorException('Failed to generate mind map');
    }
  }

  async findAllByUser(userId: string) {
    return this.mindMapRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string) {
    return this.mindMapRepository.findOne({
      where: { id, userId },
    });
  }
}
