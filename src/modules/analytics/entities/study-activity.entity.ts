import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  RelationId,
} from 'typeorm';
import type { User } from '../../../users/entities/user.entity';

export enum ActivityType {
  QUIZ = 'QUIZ',
  FLASHCARD = 'FLASHCARD',
  DOCUMENT_READ = 'DOCUMENT_READ',
  MIND_MAP = 'MIND_MAP',
  STUDY_PLAN = 'STUDY_PLAN',
}

@Entity('study_activities')
@Index(['userId', 'createdAt'])
export class StudyActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('User')
  @JoinColumn({ name: 'user_id' })
  user: any;

  @RelationId((activity: StudyActivity) => activity.user)
  @Column({ name: 'user_id' })
  userId: string;

  @Column({
    type: 'enum',
    enum: ActivityType,
  })
  type: ActivityType;

  @Column({ type: 'int', default: 0 })
  score: number;

  @Column({ type: 'int', default: 0 })
  totalQuestions: number;

  @Column({ type: 'int', default: 0 })
  correctAnswers: number;

  @Column({ type: 'int', default: 0 })
  durationSeconds: number;

  @Column({ nullable: true })
  metadata: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
