import { 
  Injectable, 
  NotFoundException, 
  Logger 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { AIService } from './ai.service';
import { ProgressService } from '../progress/progress.service';
import * as fs from 'fs';
import PDFParser from 'pdf2json';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
    
    @InjectRepository(ChatMessage)
    private chatRepository: Repository<ChatMessage>,
    
    private aiService: AIService,
    private progressService: ProgressService,
  ) {}

  /**
   * 1. Xử lý Upload: Lưu DB gắn với Account và kích hoạt AI xử lý ngầm
   */
  async create(file: Express.Multer.File, userId: string) {
    // Lưu bản ghi vào DB với quan hệ User
    const doc = await this.documentsRepository.save({
      fileName: file.originalname,
      fileSize: file.size,
      filePath: file.path, 
      user: { id: userId }, 
      status: 'PROCESSING',
    });

    // Chạy ngầm việc trích xuất và tóm tắt (Background Task)
    const input = file.path || file.buffer;
    this.extractAndSummarize(doc, input);

    return doc;
  }

  /**
   * 2. Trích xuất Text & Gemini tóm tắt (Hỗ trợ RTX 5080 xử lý cực nhanh)
   */
  async extractAndSummarize(document: Document, input: string | Buffer) {
    const pdfParser = new PDFParser(null, true);

    try {
      const extractedText = await new Promise<string>((resolve, reject) => {
        pdfParser.on('pdfParser_dataError', (errData: any) => reject(new Error(errData.parserError)));
        pdfParser.on('pdfParser_dataReady', () => resolve(pdfParser.getRawTextContent()));

        if (Buffer.isBuffer(input)) {
          pdfParser.parseBuffer(input);
        } else {
          pdfParser.loadPDF(input);
        }
      });

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('PDF không có nội dung văn bản');
      }

      const cleanText = extractedText.substring(0, 15000);

      // Cập nhật text đã trích xuất
      await this.documentsRepository.update(document.id, {
        contentText: cleanText,
        status: 'SUMMARIZING',
      });

      // Gọi AI tóm tắt
      const summary = await this.aiService.generateSummary(cleanText);

      await this.documentsRepository.update(document.id, {
        summary: summary,
        status: 'COMPLETED',
      });

      this.logger.log(`✅ Thành công: ${document.fileName} đã xử lý xong.`);
    } catch (error) {
      this.logger.error(`❌ Lỗi xử lý ${document.id}: ${error.message}`);
      await this.documentsRepository.update(document.id, { status: 'FAILED' });
    }
  }

  /**
   * 3. Lịch sử Chat: Lưu tin nhắn mới (Gắn ID để tạo Tab riêng)
   */
  async saveMessage(userId: string, docId: string, question: string, answer: string) {
    return await this.chatRepository.save({
      question,
      answer,
      user: { id: userId },
      document: { id: docId }
    });
  }

  /**
   * 4. Lịch sử Chat: Lấy tin nhắn theo từng Tab tài liệu
   */
  async getChatHistory(docId: string, userId: string) {
    return await this.chatRepository.find({
      where: { 
        document: { id: docId },
        user: { id: userId }
      },
      order: { createdAt: 'ASC' }
    });
  }

  /**
   * 5. Quản lý Tài liệu: Lấy danh sách PDF của riêng Account
   */
  async findAllByUser(userId: string) {
    return await this.documentsRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 6. Quản lý Tài liệu: Tìm 1 cái (Quan trọng để check Auth)
   */
  async findOne(id: string, userId: string) {
    const doc = await this.documentsRepository.findOne({
      where: { id: id, user: { id: userId } },
    });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu này!');
    return doc;
  }

  /**
   * 7. Quản lý Tài liệu: Xóa sạch (File + DB)
   */
  async remove(id: string, userId: string) {
    const doc = await this.findOne(id, userId);

    if (doc.filePath && fs.existsSync(doc.filePath)) {
      try { fs.unlinkSync(doc.filePath); } catch (err) {}
    }

    await this.documentsRepository.delete(id);
    return { message: 'Đã xóa tài liệu và các dữ liệu liên quan.' };
  }
}