import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Document } from './document.entity';
import { Conversation } from './conversation.entity';

export type ChatMessageType = 'QA' | 'ARTIFACT';
export type ChatArtifactType = 'QUIZ' | 'STUDY_PLAN';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', nullable: true })
  question!: string | null;

  @Column({ type: 'text', nullable: true })
  answer!: string | null;

  @Column({ name: 'message_type', type: 'text', default: 'QA' })
  messageType!: ChatMessageType;

  @Column({ name: 'artifact_type', type: 'text', nullable: true })
  artifactType!: ChatArtifactType | null;

  @Column({ name: 'artifact_json', type: 'jsonb', nullable: true })
  artifactJson!: unknown;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Document)
  @JoinColumn({ name: 'document_id' })
  document!: Document;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;
}
