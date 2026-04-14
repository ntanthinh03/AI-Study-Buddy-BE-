import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('learning_lessons')
export class LearningLesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'text' })
  userId: string;

  @Column({ name: 'document_id', type: 'text', nullable: true })
  documentId: string | null;

  @Column({ name: 'title', type: 'text' })
  title: string;

  @Column({ name: 'content_text', type: 'text' })
  contentText: string;

  @Column({ name: 'quiz_json', type: 'jsonb', nullable: true })
  quizJson: unknown;

  @Column({ name: 'last_studied_at', type: 'timestamptz', nullable: true })
  lastStudiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
