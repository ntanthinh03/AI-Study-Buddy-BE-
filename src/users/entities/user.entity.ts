import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  OneToMany, 
  CreateDateColumn, 
  UpdateDateColumn 
} from 'typeorm';
import { Document } from '../../documents/entities/document.entity';
import { Quiz } from '../../quizzes/entities/quiz.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true, select: false })
  password: string;

  @Column({ name: 'full_name', nullable: true }) 
  fullName: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ default: 'local' })
  provider: string;

  @Column({ name: 'googleId', nullable: true })
  googleId: string;

  // ✅ Quan hệ 1-N: Một User có nhiều tài liệu PDF
  @OneToMany(() => Document, (document) => document.user)
  documents: Document[];

  // ✅ Quan hệ 1-N: Một User có nhiều bộ Quiz đã tạo
  @OneToMany(() => Quiz, (quiz) => quiz.user)
  quizzes: Quiz[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' }) // Nên dùng updated_at cho đồng bộ với created_at
  updatedAt: Date;
  
}