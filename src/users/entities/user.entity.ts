import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Document } from '../../documents/entities/document.entity';
import { Quiz } from '../../quizzes/entities/quiz.entity';
import { PasswordReset } from '../../auth/entities/password-reset.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ nullable: true, select: false })
  password!: string;

  @Column({ name: 'full_name', nullable: true })
  fullName!: string;

  @Column({ name: 'phone_number', nullable: true })
  phoneNumber!: string;

  @Column({ nullable: true })
  avatar!: string;

  @Column({ default: 'local' })
  provider!: string;

  @Column({ name: 'googleId', nullable: true })
  googleId!: string;

  @OneToMany(() => Document, (document) => document.user)
  documents!: Document[];

  @OneToMany(() => Quiz, (quiz) => quiz.user)
  quizzes!: Quiz[];

  @OneToMany(() => PasswordReset, (passwordReset) => passwordReset.user)
  passwordResets!: PasswordReset[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
