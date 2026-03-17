// src/quizzes/entities/quiz.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Document } from '../../documents/entities/document.entity';

@Entity('quizzes')
export class Quiz {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb' }) // Lưu mảng câu hỏi dạng JSON
  questions: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Thuộc về Account nào
  @ManyToOne(() => User, (user) => user.quizzes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Thuộc về PDF nào
  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: Document;
}