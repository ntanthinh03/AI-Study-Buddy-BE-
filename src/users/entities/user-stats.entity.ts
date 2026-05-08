import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

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

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
