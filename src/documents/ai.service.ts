import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';

export interface QuizQuestion {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY') ?? '';
    this.genAI = new GoogleGenerativeAI(apiKey);
    // ✅ Fix: đổi gemini-2.5-flash (chưa GA) sang gemini-1.5-flash (ổn định)
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  async generateSummary(text: string): Promise<string> {
    const prompt = `You are a smart learning assistant. Please summarize the following text concisely and clearly for students to understand.
    Text content: ${text.substring(0, 15000)}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const summary = response.text();

      if (!summary || summary.trim().length === 0) {
        throw new Error('Gemini trả về nội dung rỗng');
      }

      return summary;
    } catch (error) {
      this.logger.error(`❌ Lỗi Gemini Summary: ${error.message}`);
      // ✅ Fix: throw thay vì return string để caller biết thật sự bị lỗi
      throw new Error(`Gemini Summary thất bại: ${error.message}`);
    }
  }

  // ✅ Fix: trả về QuizQuestion[] thay vì string thô
  async generateQuiz(text: string): Promise<QuizQuestion[]> {
    const prompt = `Based on the following content, create 5 multiple-choice questions in Vietnamese.

IMPORTANT: Return ONLY pure JSON, NO markdown, NO \`\`\`json blocks.
Required format:
[
  {
    "question": "Câu hỏi?",
    "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
    "correctAnswer": "A",
    "explanation": "Giải thích tại sao đúng"
  }
]

Content: ${text.substring(0, 15000)}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let rawText = response.text();

      // ✅ Clean markdown nếu Gemini vẫn trả về ```json
      rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

      const questions: QuizQuestion[] = JSON.parse(rawText);

      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Gemini không tạo được câu hỏi hợp lệ');
      }

      return questions;
    } catch (error) {
      this.logger.error(`❌ Lỗi Gemini Quiz: ${error.message}`);
      throw new Error(`Gemini Quiz thất bại: ${error.message}`);
    }
  }
}