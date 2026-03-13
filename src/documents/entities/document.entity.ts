import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
// import { User } from '../../users/entities/user.entity'; // (Bỏ comment khi bạn đã tạo User Entity)

@Entity('documents') // Tên bảng trong DB
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', nullable: true }) // Tạm thời để null được để test
  userId: string;

  @Column({ nullable: true }) // Thêm nullable: true ở đây
  fileUrl: string;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'file_size', nullable: true }) // ✅ Thêm nullable: true
  fileSize: number;

  @Column({ name: 'content_text', type: 'text', nullable: true })
  contentText: string;

  @Column({ default: 'PENDING' })
  status: string; // PENDING, PROCESSING, COMPLETED, FAILED

  @Column({ type: 'text', nullable: true })
  summary: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}