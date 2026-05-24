import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum LearningMode {
  CASUAL = 'CASUAL',
  BALANCED = 'BALANCED',
  INTENSE = 'INTENSE',
}

@Entity('user_stats')
export class UserStats {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ default: 0 })
  totalXP!: number;

  @Column({ name: 'current_streak', default: 0 })
  currentStreak!: number;

  @Column({ name: 'longest_streak', default: 0 })
  longestStreak!: number;

  @Column({ name: 'last_study_date', type: 'timestamp', nullable: true })
  lastStudyDate!: Date | null;

  @Column({ default: 1 })
  level!: number;

  @Column({ name: 'total_focus_time', default: 0 })
  totalFocusTime!: number;

  @Column({
    type: 'varchar',
    name: 'learning_mode',
    default: 'BALANCED',
  })
  learningMode!: string;

  @Column({
    name: 'preferred_notification_time',
    type: 'varchar',
    default: '20:00',
  })
  preferredNotificationTime!: string;

  @Column({
    name: 'streak_freeze_available',
    type: 'int',
    default: 1,
  })
  streakFreezeAvailable!: number;

  @Column({
    name: 'versus_warnings_count',
    type: 'int',
    default: 0,
  })
  versusWarningsCount!: number;

  @Column({
    name: 'versus_lockout_until',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  versusLockoutUntil!: Date | null;

  @Column({
    name: 'elo',
    type: 'int',
    default: 1200,
  })
  elo!: number;

  @Column({
    name: 'versus_win_streak',
    type: 'int',
    default: 0,
  })
  versusWinStreak!: number;

  @Column({
    name: 'arena_name',
    type: 'varchar',
    nullable: true,
    unique: true,
    default: null,
  })
  arenaName!: string | null;

  @Column({
    name: 'last_arena_name_change',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  lastArenaNameChange!: Date | null;

  @Column({
    name: 'fcm_token',
    type: 'varchar',
    nullable: true,
  })
  fcmToken!: string | null;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
