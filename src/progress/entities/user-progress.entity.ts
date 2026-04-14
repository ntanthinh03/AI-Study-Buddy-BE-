import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Document } from '../../documents/entities/document.entity';

@Entity('user_progress')
export class UserProgress {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  userId!: string;

  @ManyToOne(() => Document)
  document!: Document;

  @Column({ default: false })
  isCompleted!: boolean;

  @Column({ default: true })
  isLocked!: boolean;

  @Column({ type: 'float', nullable: true })
  highestScore!: number;
}
