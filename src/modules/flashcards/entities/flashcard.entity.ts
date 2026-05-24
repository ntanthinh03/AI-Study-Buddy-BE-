import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import type { User } from '../../../users/entities/user.entity';
import { Document } from '../../../documents/entities/document.entity';

@Entity('flashcards')
@Index(['user', 'nextReview'])
export class Flashcard {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  front!: string;

  @Column({ type: 'text' })
  back!: string;

  @Column({ default: 0 })
  box!: number;

  @Column({ name: 'next_review', type: 'timestamp', nullable: true })
  nextReview!: Date;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: any;

  @ManyToOne(() => Document, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'document_id' })
  document!: Document;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
