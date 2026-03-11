import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AIService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(private configService: ConfigService) {
    // Sửa lỗi ở đây bằng cách thêm ?? ''
    const apiKey = this.configService.get<string>('GEMINI_API_KEY') ?? '';
    this.genAI = new GoogleGenerativeAI(apiKey);
    
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  async generateSummary(text: string): Promise<string> {
    const prompt = `You are a smart learning assistant. Please summarize the following text concisely and clearly for students to understand.
    Text content: ${text.substring(0, 20000)}`; // Giới hạn ký tự để tránh quá tải

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Lỗi Gemini Summary:', error);
      return 'Không thể tạo bản tóm tắt tại thời điểm này.';
    }
  }

  async generateQuiz(text: string): Promise<string> {
    const prompt = `Based on the following content, please create 5 multiple-choice questions (each with 4 options: A, B, C, D) including the correct answers to help students review.
    Content: ${text.substring(0, 20000)}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Lỗi Gemini Quiz:', error);
      return 'Không thể tạo bộ câu hỏi lúc này.';
    }
  }
}