import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../../users/entities/user.entity';
import { Document } from '../../../documents/entities/document.entity';

export enum MatchStatus {
  LOBBY = 'LOBBY',
  PVP_LOBBY = 'PVP_LOBBY',
  GENERATING_INITIAL = 'GENERATING_INITIAL',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ABORTED = 'ABORTED',
}

@Entity('versus_matches')
export class VersusMatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Document, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'document_id' })
  document!: Document | null;

  @Column({
    type: 'varchar',
    name: 'status',
    default: MatchStatus.GENERATING_INITIAL,
  })
  status!: string;

  @Column({
    type: 'varchar',
    name: 'mode',
    default: 'BOT',
  })
  mode!: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'opponent_id' })
  opponent!: User | null;

  @Column({ name: 'room_code', type: 'varchar', nullable: true })
  roomCode!: string | null;

  @Column({ name: 'opponent_name', type: 'varchar', default: 'AI Bot' })
  opponentName!: string;

  @Column({ name: 'opponent_elo', type: 'int', default: 1200 })
  opponentElo!: number;

  @Column({ name: 'difficulty', type: 'varchar', default: 'MEDIUM' })
  difficulty!: string;

  @Column({ name: 'player_score', type: 'int', default: 0 })
  playerScore!: number;

  @Column({ name: 'bot_score', type: 'int', default: 0 })
  botScore!: number;

  @Column({ name: 'player_correct_count', type: 'int', default: 0 })
  playerCorrectCount!: number;

  @Column({ name: 'bot_correct_count', type: 'int', default: 0 })
  botCorrectCount!: number;

  @Column({ type: 'jsonb', default: [] })
  questions!: any[];

  @Column({ type: 'jsonb', name: 'player_answers', default: {} })
  playerAnswers!: Record<number, { selectedAnswer: string; scoreEarned: number; timeTakenSeconds: number }>;

  @Column({ type: 'jsonb', name: 'bot_answers', default: {} })
  botAnswers!: Record<number, { selectedAnswer: string; isCorrect: boolean }>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
