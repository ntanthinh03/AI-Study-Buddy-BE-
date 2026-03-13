import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Document } from '../../documents/entities/document.entity';

@Entity('quizzes')
export class Quiz {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('jsonb') 
  questions: any;

  @Column({ default: 80 })
  passingScore: number;

  @ManyToOne(() => Document, (doc) => doc.id)
  document: Document;

  @CreateDateColumn()
  createdAt: Date;
}