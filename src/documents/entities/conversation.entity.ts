import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Document } from './document.entity';
import { ChatMessage } from './chat-message.entity';

export type ConversationKind = 'CHAT' | 'QUIZ' | 'PLAN';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'document_id' })
  documentId!: string;

  @Column({ name: 'title' })
  title!: string;

  @Column({ name: 'kind', type: 'text', default: 'CHAT' })
  kind!: ConversationKind;

  @Column({ name: 'last_message_preview', type: 'text', nullable: true })
  lastMessagePreview!: string | null;

  @Column({ name: 'last_artifact_type', type: 'text', nullable: true })
  lastArtifactType!: 'QUIZ' | 'STUDY_PLAN' | null;

  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true })
  lastMessageAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document!: Document;

  @OneToMany(() => ChatMessage, (message) => message.conversation)
  messages!: ChatMessage[];
}
