import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Conversation } from '../../documents/entities/conversation.entity';

export type LessonStatus = 'IN_PROGRESS' | 'COMPLETED';

@Entity('learning_lessons')
export class LearningLesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'text' })
  userId: string;

  @Column({ name: 'document_id', type: 'text', nullable: true })
  documentId: string | null;

  @Column({ name: 'conversation_id', type: 'uuid', nullable: true })
  conversationId: string | null;

  @Column({ name: 'course_name', type: 'text', nullable: true })
  courseName: string | null;

  @Column({ name: 'title', type: 'text' })
  title: string;

  @Column({ name: 'content_text', type: 'text' })
  contentText: string;

  @Column({ name: 'quiz_json', type: 'jsonb', nullable: true })
  quizJson: unknown;

  @Column({ name: 'status', type: 'text', default: 'IN_PROGRESS' })
  status: LessonStatus;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'last_studied_at', type: 'timestamptz', nullable: true })
  lastStudiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation | null;
}
