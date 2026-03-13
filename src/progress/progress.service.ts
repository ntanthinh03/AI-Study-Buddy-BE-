import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm'; // Sử dụng MoreThan để tìm bài tiếp theo
import { UserProgress } from './entities/user-progress.entity';
import { Document } from '../documents/entities/document.entity';

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(UserProgress)
    private progressRepository: Repository<UserProgress>,
  ) {}

  async getTimeline(userId: string) {
    return await this.progressRepository.find({
      where: { userId },
      relations: ['document'],
      order: { document: { createdAt: 'ASC' } }, // Sắp xếp theo thứ tự thời gian
    });
  }
  /**
   * Khởi tạo lộ trình học tập.
   * Nếu là bài đầu tiên của user, nó sẽ được MỞ KHÓA tự động.
   */
  async initializeProgress(userId: string, documentId: string) {
    const existing = await this.progressRepository.findOne({
      where: { userId, document: { id: documentId } },
    });

    if (existing) return existing;

    // Kiểm tra xem user đã có bài nào chưa để quyết định khóa hay mở bài đầu tiên
    const count = await this.progressRepository.count({ where: { userId } });

    const newProgress = this.progressRepository.create({
      userId,
      document: { id: documentId } as Document,
      isCompleted: false,
      isLocked: count > 0, // Nếu là bài thứ 2 trở đi thì mới khóa
    });

    return await this.progressRepository.save(newProgress);
  }

  /**
   * Lấy toàn bộ Timeline cho App Android hiển thị.
   */
  async getMyProgress(userId: string) {
    return await this.progressRepository.find({
      where: { userId },
      relations: ['document'],
      order: { document: { createdAt: 'ASC' } }, // Sắp xếp theo thứ tự thời gian upload
    });
  }

  /**
   * Logic quan trọng nhất: Hoàn thành bài hiện tại và MỞ KHÓA bài tiếp theo.
   */
  async unlockNextModule(userId: string, documentId: string, score: number) {
    // 1. Tìm và cập nhật trạng thái bài hiện tại
    const currentProgress = await this.progressRepository.findOne({
      where: { userId, document: { id: documentId } },
      relations: ['document'],
    });

    if (currentProgress) {
      currentProgress.isCompleted = true;
      currentProgress.highestScore = score;
      currentProgress.isLocked = false; 
      await this.progressRepository.save(currentProgress);

      // 2. TÌM BÀI TIẾP THEO: Dựa trên thời gian tạo (createdAt) lớn hơn bài vừa xong
      const nextProgress = await this.progressRepository.findOne({
        where: {
          userId,
          isLocked: true,
          document: { createdAt: MoreThan(currentProgress.document.createdAt) },
        },
        order: { document: { createdAt: 'ASC' } },
      });

      // 3. Mở khóa bài tiếp theo nếu tìm thấy
      if (nextProgress) {
        nextProgress.isLocked = false;
        await this.progressRepository.save(nextProgress);
        return { message: 'Current module completed, next module unlocked!', nextModule: nextProgress.id };
      }
    }

    return { message: 'Module updated successfully.' };
  }
}