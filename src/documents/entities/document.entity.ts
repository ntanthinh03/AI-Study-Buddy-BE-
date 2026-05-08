import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'file_name' })
  fileName!: string;

  @Column({ name: 'file_size' })
  fileSize!: number;

  @Column({ name: 'file_path', type: 'text', nullable: true })
  filePath!: string | null;

  @Column({ name: 'content_text', type: 'text', nullable: true })
  contentText!: string | null;

  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @Column({ name: 'summary_status', default: 'PROCESSING' })
  summaryStatus!: string;

  @Column({ name: 'rag_status', default: 'PENDING' })
  ragStatus!: string;

  @Column({ default: 'PROCESSING' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne('User', 'documents', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: any; // Use any or a specific interface to avoid circular type issues at runtime
}
