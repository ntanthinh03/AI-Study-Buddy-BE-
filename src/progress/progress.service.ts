import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { UserProgress } from './entities/user-progress.entity';
import { Document } from '../documents/entities/document.entity';
import { LearningLesson } from './entities/learning-lesson.entity';
import { SaveLessonDto } from './dto/save-lesson.dto';
import { PROGRESS_MESSAGES } from '../common/constants/messages';

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(UserProgress)
    private progressRepository: Repository<UserProgress>,
    @InjectRepository(LearningLesson)
    private lessonRepository: Repository<LearningLesson>,
  ) {}

  async getTimeline(userId: string) {
    return await this.progressRepository.find({
      where: { userId },
      relations: ['document'],
      order: { document: { createdAt: 'ASC' } },
    });
  }
  async initializeProgress(userId: string, documentId: string) {
    const existing = await this.progressRepository.findOne({
      where: { userId, document: { id: documentId } },
    });

    if (existing) return existing;

    const count = await this.progressRepository.count({ where: { userId } });

    const newProgress = this.progressRepository.create({
      userId,
      document: { id: documentId } as Document,
      isCompleted: false,
      isLocked: count > 0,
    });

    return await this.progressRepository.save(newProgress);
  }

  async getMyProgress(userId: string) {
    return await this.progressRepository.find({
      where: { userId },
      relations: ['document'],
      order: { document: { createdAt: 'ASC' } },
    });
  }
  async unlockNextModule(userId: string, documentId: string, score: number) {
    const currentProgress = await this.progressRepository.findOne({
      where: { userId, document: { id: documentId } },
      relations: ['document'],
    });

    if (currentProgress) {
      currentProgress.isCompleted = true;
      currentProgress.highestScore = score;
      currentProgress.isLocked = false;
      await this.progressRepository.save(currentProgress);

      const nextProgress = await this.progressRepository.findOne({
        where: {
          userId,
          isLocked: true,
          document: { createdAt: MoreThan(currentProgress.document.createdAt) },
        },
        order: { document: { createdAt: 'ASC' } },
      });

      if (nextProgress) {
        nextProgress.isLocked = false;
        await this.progressRepository.save(nextProgress);
        return {
          message: PROGRESS_MESSAGES.NEXT_MODULE_UNLOCKED,
          nextModule: nextProgress.id,
        };
      }
    }

    return { message: PROGRESS_MESSAGES.MODULE_UPDATED };
  }

  async saveLesson(userId: string, dto: SaveLessonDto) {
    const lesson = this.lessonRepository.create({
      userId,
      documentId: dto.documentId ?? null,
      title: dto.title,
      contentText: dto.contentText,
      lastStudiedAt: new Date(),
    });

    return await this.lessonRepository.save(lesson);
  }

  async getMyLessons(userId: string) {
    return await this.lessonRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async getLessonById(userId: string, lessonId: string) {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId, userId },
    });

    if (!lesson) {
      throw new NotFoundException(PROGRESS_MESSAGES.LESSON_NOT_FOUND);
    }

    return lesson;
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
}
