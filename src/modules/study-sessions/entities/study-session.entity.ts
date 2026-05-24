import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import type { User } from '../../../users/entities/user.entity';

export enum SessionStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('study_sessions')
@Index(['user', 'createdAt'])
export class StudySession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: SessionStatus, default: SessionStatus.IN_PROGRESS })
  status!: SessionStatus;

  @Column({ type: 'jsonb' })
  content!: {
    quizQuestions: any[];
    flashcards: any[];
  };

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @Column({ default: 0 })
  xpEarned!: number;

  @Column({ default: 0 })
  correctAnswers!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: any;
}
