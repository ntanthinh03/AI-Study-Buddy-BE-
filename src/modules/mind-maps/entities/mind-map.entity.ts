import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from '../../../users/entities/user.entity';
import { Document } from '../../../documents/entities/document.entity';

@Entity('mind_maps')
export class MindMap {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'title' })
  title: string;

  @Column({ type: 'jsonb' })
  content: any; 

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: any;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'document_id' })
  document: Document;

  @Column({ name: 'document_id', nullable: true })
  documentId: string;
}
