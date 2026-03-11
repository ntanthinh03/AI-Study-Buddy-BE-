import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { AIService } from './ai.service';
import * as fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFParser = require('pdf2json');

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
    private aiService: AIService,
  ) {}

  async create(file: Express.Multer.File) {
    const newDoc = this.documentsRepository.create({
      fileName: file.originalname,
      fileUrl: file.path,
      fileSize: file.size,
      status: 'PROCESSING',
    });

    const savedDoc = await this.documentsRepository.save(newDoc);
    this.extractAndSummarize(savedDoc, file.path);
    return savedDoc;
  }

  async extractAndSummarize(document: Document, filePath: string) {
    const pdfParser = new PDFParser(null, 1); // Tham số 1 giúp lấy text thuần túy

    pdfParser.on('pdfParser_dataError', async (errData: any) => {
      console.error('❌ Lỗi đọc PDF:', errData.parserError);
      document.status = 'FAILED';
      await this.documentsRepository.save(document);
    });

    pdfParser.on('pdfParser_dataReady', async (pdfData: any) => {
      try {
        // Tách chữ từ các trang của PDF
        const text = pdfParser.getRawTextContent();
        
        if (!text || text.trim().length === 0) {
          throw new Error('Không có nội dung văn bản');
        }

        console.log('--- Đã tách chữ thành công. Đang gửi AI tóm tắt ---');
        
        document.contentText = text;
        await this.documentsRepository.save(document);

        const summary = await this.aiService.generateSummary(text);
        
        document.summary = summary;
        document.status = 'COMPLETED';
        await this.documentsRepository.save(document);
        
        console.log(`✅ Hoàn thành: ${document.fileName}`);
      } catch (error) {
        console.error('❌ Lỗi xử lý AI:', error.message);
        document.status = 'FAILED';
        await this.documentsRepository.save(document);
      }
    });

    // Bắt đầu đọc file
    pdfParser.loadPDF(filePath);
  }

  findAll() {
    return this.documentsRepository.find({ order: { createdAt: 'DESC' } });
  }
}