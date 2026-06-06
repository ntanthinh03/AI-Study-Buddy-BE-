import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { StudyActivity, ActivityType } from './entities/study-activity.entity';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  constructor(
    @InjectRepository(StudyActivity)
    private readonly activityRepository: Repository<StudyActivity>,
  ) {}

  async logActivity(
    user: User,
    type: ActivityType,
    data: {
      score?: number;
      totalQuestions?: number;
      correctAnswers?: number;
      durationSeconds?: number;
      metadata?: any;
    },
  ) {
    if (!user || !user.id) {
      this.logger.warn('Analytics log skipped: missing user');
      return null;
    }

    const activity = this.activityRepository.create({
      user,
      userId: user.id,
      type,
      score: Math.round(data.score || 0),
      totalQuestions: Math.round(data.totalQuestions || 0),
      correctAnswers: Math.round(data.correctAnswers || 0),
      durationSeconds: Math.round(data.durationSeconds || 0),
      metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
    });

    return await this.activityRepository.save(activity);
  }

  async getUserStats(userId: string) {
    const [activities, totalQuizzes, totalFlashcards] = await Promise.all([
      this.activityRepository.find({
        where: { user: { id: userId } },
        order: { createdAt: 'DESC' },
        take: 10,
      }),
      this.activityRepository.count({
        where: { user: { id: userId }, type: ActivityType.QUIZ },
      }),
      this.activityRepository.count({
        where: { user: { id: userId }, type: ActivityType.FLASHCARD },
      }),
    ]);

    const accuracy =
      activities.length > 0
        ? Math.round(
            activities.reduce((acc, curr) => acc + (curr.score || 0), 0) /
              activities.length,
          )
        : 0;

    return {
      totalQuizzes,
      totalFlashcards,
      accuracy,
      recentActivities: activities,
    };
  }

  async getWeeklyChartData(userId: string) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const activities = await this.activityRepository.find({
      where: {
        user: { id: userId },
        createdAt: Between(sevenDaysAgo, now),
      },
    });

    const chartData = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateString = date.toISOString().split('T')[0];
      chartData[dateString] = 0;
    }

    activities.forEach(a => {
      const dateObj = typeof a.createdAt === 'string' ? new Date(a.createdAt) : a.createdAt;
      if (dateObj && typeof dateObj.toISOString === 'function') {
        const dateString = dateObj.toISOString().split('T')[0];
        if (chartData[dateString] !== undefined) {
            chartData[dateString] += a.correctAnswers;
        }
      }
    });

    return Object.keys(chartData).map(date => ({
      date,
      count: chartData[date],
    })).reverse();
  }
}
