
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { AIService } from './ai.service';
import { ProgressService } from '../progress/progress.service'; // Integrated Progress tracking
import * as fs from 'fs';
import { Injectable } from '@nestjs/common';
import PDFParser from 'pdf2json';
// eslint-disable-next-line @typescript-eslint/no-var-requires


@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
    private aiService: AIService,
    private progressService: ProgressService, // Injected for Notion-like progress
  ) {}

  /**
   * Handles document upload and initializes the learning progress.
   *
   */
  async create(file: Express.Multer.File, userId: string) {
  // 1. Lưu bản ghi ban đầu
  const doc = await this.documentsRepository.save({
    fileName: file.originalname,
    fileSize: file.size,
    userId: userId,
    status: 'PROCESSING'
  });

  // 2. Chạy ngầm việc tóm tắt. Dùng file.buffer hoặc file.path tùy cấu hình
  const input = file.path || file.buffer; 
  this.extractAndSummarize(doc, input); 

  return doc;
}

  /**
   * Extracts text from PDF and generates an AI summary via Gemini.
   *
   */
  async extractAndSummarize(document: any, input: string | Buffer) {
  const pdfParser = new PDFParser(null, true); // Mode 1: Lấy raw text

  try {
    // 1. Bọc PDFParser vào Promise để dùng await thực thụ
    const extractedText = await new Promise<string>((resolve, reject) => {
      pdfParser.on('pdfParser_dataError', (errData: any) => {
        console.error('❌ Lỗi đọc PDF:', errData.parserError);
        reject(new Error('Không thể trích xuất văn bản từ PDF'));
      });

      pdfParser.on('pdfParser_dataReady', () => {
        const text = pdfParser.getRawTextContent();
        resolve(text);
      });

      // Kiểm tra đầu vào để chọn đúng hàm load
      if (Buffer.isBuffer(input)) {
        pdfParser.parseBuffer(input);
      } else {
        pdfParser.loadPDF(input);
      }
    });

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('PDF không có nội dung văn bản (có thể là file ảnh scan)');
    }

    // 2. Cập nhật nội dung thô và trạng thái trung gian
    // Giới hạn 15k ký tự để Gemini xử lý nhanh nhất trên máy RTX 5080 của bạn
    const cleanText = extractedText.substring(0, 15000); 
    
    await this.documentsRepository.update(document.id, {
      contentText: cleanText,
      status: 'SUMMARIZING' // Trạng thái để bạn check real-time
    });
    console.log(`--- 📄 Đã trích xuất xong. Đang gửi sang Gemini... ---`);

    // 3. Gọi AI tóm tắt
    const summary = await this.aiService.generateSummary(cleanText);

    // 4. Hoàn tất
    await this.documentsRepository.update(document.id, {
      summary: summary,
      status: 'COMPLETED'
    });
    
    console.log(`✅ Thành công: ${document.fileName} đã sẵn sàng!`);

  } catch (error) {
    console.error('❌ Lỗi xử lý:', error.message);
    // Đảm bảo cập nhật FAILED để người dùng không phải đợi vô tận
    await this.documentsRepository.update(document.id, {
      status: 'FAILED'
    });
  }
}

  findAll() {
    return this.documentsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    return await this.documentsRepository.findOneBy({ id });
  }
  async processAI(documentId: string, text: string) {
  console.log(`[${new Date().toLocaleTimeString()}] 🚀 Bắt đầu xử lý Document ID: ${documentId}`);
  
  try {
    console.log(`[${new Date().toLocaleTimeString()}] 📄 Đang trích xuất text (${text.length} ký tự)...`);
    
    // Giả sử bước này gọi Gemini
    console.log(`[${new Date().toLocaleTimeString()}] 🤖 Đang gửi dữ liệu sang Gemini API...`);
    const summary = await this.aiService.generateSummary(text); //
    
    console.log(`[${new Date().toLocaleTimeString()}] ✅ Gemini đã phản hồi thành công!`);

    await this.documentsRepository.update(documentId, {
      summary,
      status: 'COMPLETED',
    });
  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ Lỗi tại bước AI:`, error.message);
    await this.documentsRepository.update(documentId, { status: 'FAILED' });
  }
}
}