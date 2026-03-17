import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity'; // Đảm bảo đúng đường dẫn

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'file_size' })
  fileSize: number;

  // ✅ 1. THÊM CỘT NÀY: Để lưu đường dẫn file vật lý và xóa file
  @Column({ name: 'file_path', nullable: true })
  filePath: string;

  @Column({ name: 'content_text', type: 'text', nullable: true })
  contentText: string;

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column({ default: 'PROCESSING' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // ✅ 2. THÊM QUAN HỆ NÀY: Để dùng được where: { user: { id: userId } }
  @ManyToOne(() => User, (user) => user.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}