import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { AIService } from './ai.service';
import { ProgressService } from '../progress/progress.service';
import * as fs from 'fs';
import PDFParser from 'pdf2json';
import { UploadedFile } from '../common/types/uploaded-file.type';

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

  async create(file: UploadedFile, userId: string) {
    const doc = await this.documentsRepository.save({
      fileName: file.originalname,
      fileSize: file.size,
      filePath: file.path,
      user: { id: userId },
      status: 'PROCESSING',
    });

    const input = file.path || file.buffer;
    const mimeType = file.mimetype || this.inferMimeType(file.originalname);
    void this.processUploadedFile(doc, input, mimeType);

    return doc;
  }

  private inferMimeType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();

    if (extension === 'png') return 'image/png';
    if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
    if (extension === 'webp') return 'image/webp';
    return 'application/pdf';
  }

  private isImageMimeType(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  private async processUploadedFile(document: Document, input: string | Buffer, mimeType: string) {
    if (this.isImageMimeType(mimeType)) {
      const imageBuffer = Buffer.isBuffer(input) ? input : fs.readFileSync(input);
      await this.processImageAndSummarize(document, imageBuffer, mimeType);
      return;
    }

    await this.extractAndSummarize(document, input);
  }

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
        throw new Error('PDF does not contain extractable text');
      }

      const cleanText = extractedText.substring(0, 15000);
      await this.documentsRepository.update(document.id, {
        contentText: cleanText,
        status: 'SUMMARIZING',
      });

      const summary = await this.aiService.generateSummary(cleanText);

      await this.documentsRepository.update(document.id, {
        summary,
        status: 'COMPLETED',
      });

      this.logger.log(`✅ Success: ${document.fileName} processed successfully.`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Failed to process PDF ${document.id}: ${message}`);
      await this.documentsRepository.update(document.id, { status: 'FAILED' });
    }
  }

  async processImageAndSummarize(document: Document, imageBuffer: Buffer, mimeType: string) {
    try {
      await this.documentsRepository.update(document.id, {
        status: 'SUMMARIZING',
      });

      const { extractedText, summary } = await this.aiService.analyzeImageAndSummarize(imageBuffer, mimeType);

      await this.documentsRepository.update(document.id, {
        contentText: extractedText,
        summary,
        status: 'COMPLETED',
      });

      this.logger.log(`✅ Success: image ${document.fileName} processed successfully.`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Failed to process image ${document.id}: ${message}`);
      await this.documentsRepository.update(document.id, { status: 'FAILED' });
    }
  }

  async saveMessage(userId: string, docId: string, question: string, answer: string) {
    return await this.chatRepository.save({
      question,
      answer,
      user: { id: userId },
      document: { id: docId },
    });
  }

  async getChatHistory(docId: string, userId: string) {
    return await this.chatRepository.find({
      where: {
        document: { id: docId },
        user: { id: userId },
      },
      order: { createdAt: 'ASC' },
    });
  }

  async findAllByUser(userId: string) {
    return await this.documentsRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string) {
    const doc = await this.documentsRepository.findOne({
      where: { id, user: { id: userId } },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async remove(id: string, userId: string) {
    const doc = await this.findOne(id, userId);

    if (doc.filePath && fs.existsSync(doc.filePath)) {
      try {
        fs.unlinkSync(doc.filePath);
      } catch {
        // Ignore filesystem cleanup issues.
      }
    }

    await this.documentsRepository.delete(id);
    return { message: 'Document and related data deleted successfully.' };
  }
}
