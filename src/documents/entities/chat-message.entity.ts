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

  @Column({
    name: 'image_data',
    type: 'bytea',
    nullable: true,
    select: false,
  })
  imageData!: Buffer | null;

  @Column({ name: 'image_mime_type', type: 'text', nullable: true })
  imageMimeType!: string | null;

  @Column({ name: 'image_original_name', type: 'text', nullable: true })
  imageOriginalName!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne('User')
  @JoinColumn({ name: 'user_id' })
  user!: any;

  @ManyToOne(() => Document, { nullable: true })
  @JoinColumn({ name: 'document_id' })
  document!: Document | null;

  @ManyToOne('Conversation', (conversation: any) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: any;
}
