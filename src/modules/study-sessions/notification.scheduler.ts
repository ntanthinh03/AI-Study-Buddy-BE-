import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserStats } from '../../users/entities/user-stats.entity';
import { AIService } from '../../common/services/ai.service';
import { StudyActivity, ActivityType } from '../analytics/entities/study-activity.entity';

@Injectable()
export class NotificationScheduler {
  private readonly logger = new Logger(NotificationScheduler.name);

  constructor(
    @InjectRepository(UserStats)
    private readonly statsRepository: Repository<UserStats>,
    @InjectRepository(StudyActivity)
    private readonly activityRepository: Repository<StudyActivity>,
    private readonly aiService: AIService,
  ) {}

  @Cron('*/15 * * * *')
  async checkAndSendReminders() {
    this.logger.log('Notification Scheduler: Starting preferred leisure hour scan...');
    const now = new Date();
    const currentHourStr = now.getHours().toString().padStart(2, '0');
    const currentMinuteStr = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${currentHourStr}:${currentMinuteStr}`;

    const statsList = await this.statsRepository.find({ relations: ['user'] });
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const stats of statsList) {
      if (!stats.user) continue;

      if (!this.isWithin15Minutes(stats.preferredNotificationTime || '20:00', currentTimeStr)) {
        continue;
      }

      const activityCount = await this.activityRepository.count({
        where: {
          user: { id: stats.user.id },
          type: ActivityType.QUIZ,
          createdAt: MoreThanOrEqual(today),
        },
      });

      let target = 3;
      if (stats.learningMode === 'CASUAL') target = 1;
      else if (stats.learningMode === 'INTENSE') target = 5;

      if (activityCount < target) {
        this.logger.log(`User ${stats.user.fullName || stats.user.email} under-target: ${activityCount}/${target}. Generating AI study reminder...`);

        const performanceStatus = `completed only ${activityCount} out of their target ${target} quizzes today.`;
        const aiMessage = await this.aiService.generateAdaptiveStudyReminder(
          stats.user.fullName || stats.user.email.split('@')[0],
          performanceStatus,
        );

        this.logger.log(`[FCM SMART PUSH] Sending notification to token: ${stats.fcmToken || 'NO_TOKEN_REGISTERED'}`);
        this.logger.log(`[FCM SMART PUSH] Payload: Title="Study Buddy Smart Reminder", Body="${aiMessage}"`);
      } else {
        this.logger.log(`User ${stats.user.fullName || stats.user.email} has met their daily target (${activityCount}/${target}). No reminder needed.`);
      }
    }
    this.logger.log('Notification Scheduler: Leisure hour scan complete.');
  }

  private isWithin15Minutes(prefTime: string, currTime: string): boolean {
    try {
      const [pHP, pMP] = prefTime.split(':').map(Number);
      const [cHP, cMP] = currTime.split(':').map(Number);
      
      const prefMin = pHP * 60 + pMP;
      const currMin = cHP * 60 + cMP;

      const diff = currMin - prefMin;
      return diff >= 0 && diff < 15;
    } catch {
      return false;
    }
  }
}
