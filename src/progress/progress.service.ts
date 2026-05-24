import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../documents/entities/document.entity';
import { LearningLesson } from './entities/learning-lesson.entity';
import { Conversation } from '../documents/entities/conversation.entity';
import { SaveLessonDto } from './dto/save-lesson.dto';
import { PROGRESS_MESSAGES } from '../common/constants/messages';

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(LearningLesson)
    private lessonRepository: Repository<LearningLesson>,
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
  ) {}

  async saveLesson(userId: string, dto: SaveLessonDto) {
    const conversation = await this.conversationRepository.findOne({
      where: { id: dto.conversationId, userId },
    });

    if (!conversation) {
      throw new NotFoundException(PROGRESS_MESSAGES.CONVERSATION_NOT_FOUND);
    }

    const lesson = this.lessonRepository.create({
      userId,
      documentId: dto.documentId ?? null,
      conversationId: dto.conversationId,
      courseName:
        dto.courseName?.trim() || conversation.title?.trim() || null,
      title: dto.title,
      contentText: dto.contentText,
      status: dto.status ?? 'IN_PROGRESS',
      completedAt: dto.status === 'COMPLETED' ? new Date() : null,
      lastStudiedAt: new Date(),
    });

    const savedLesson = await this.lessonRepository.save(lesson);
    return this.formatLessonResponse(savedLesson);
  }

  async getMyLessons(userId: string, conversationId?: string) {
    const lessons = await this.lessonRepository.find({
      where: {
        userId,
        ...(conversationId ? { conversationId } : {}),
      },
      order: { updatedAt: 'DESC' },
    });

    return lessons.map((lesson) => this.formatLessonResponse(lesson));
  }

  async getLessonById(userId: string, lessonId: string) {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId, userId },
    });

    if (!lesson) {
      throw new NotFoundException(PROGRESS_MESSAGES.LESSON_NOT_FOUND);
    }

    return this.formatLessonResponse(lesson);
  }

  async saveLessonQuiz(userId: string, lessonId: string, quiz: unknown[]) {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId, userId },
    });

    if (!lesson) {
      throw new NotFoundException(PROGRESS_MESSAGES.LESSON_NOT_FOUND);
    }

    lesson.quizJson = quiz;
    lesson.lastStudiedAt = new Date();
    await this.lessonRepository.save(lesson);

    return {
      message: PROGRESS_MESSAGES.LESSON_QUIZ_SAVED,
      lessonId: lesson.id,
      quizCount: Array.isArray(quiz) ? quiz.length : 0,
    };
  }

  async updateLessonStatus(
    userId: string,
    lessonId: string,
    status: 'IN_PROGRESS' | 'COMPLETED',
  ) {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId, userId },
    });

    if (!lesson) {
      throw new NotFoundException(PROGRESS_MESSAGES.LESSON_NOT_FOUND);
    }

    lesson.status = status;
    lesson.completedAt = status === 'COMPLETED' ? new Date() : null;
    lesson.lastStudiedAt = new Date();
    await this.lessonRepository.save(lesson);

    return {
      message: PROGRESS_MESSAGES.LESSON_STATUS_UPDATED,
      lessonId: lesson.id,
      status: lesson.status,
      completedAt: lesson.completedAt,
    };
  }

  private formatLessonResponse(lesson: LearningLesson) {
    return {
      lessonId: lesson.id,
      courseName: lesson.courseName,
      lessonTitle: lesson.title,
      contentText: lesson.contentText,
      status: lesson.status,
      completedAt: lesson.completedAt,
      conversationId: lesson.conversationId,
      documentId: lesson.documentId,
      quizJson: lesson.quizJson,
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
    };
  }
}
