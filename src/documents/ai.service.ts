import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
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
  private model: GenerativeModel;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY') ?? '';
    this.genAI = new GoogleGenerativeAI(apiKey);
    
    // ✅ Đã cập nhật model ổn định nhất hiện tại cho đồ án
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  /**
   * Tóm tắt nội dung văn bản bằng tiếng Việt
   */
  async generateSummary(text: string): Promise<string> {
    const prompt = `Bạn là một trợ lý học tập thông minh. Hãy tóm tắt nội dung sau đây một cách ngắn gọn, súc tích và dễ hiểu cho sinh viên bằng tiếng Việt.
    Nội dung: ${text.substring(0, 15000)}`;

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
      throw new Error(`Gemini Summary thất bại: ${error.message}`);
    }
  }

  /**
   * Tạo 5 câu hỏi trắc nghiệm định dạng JSON
   */
  async chatWithDocument(text: string, question: string): Promise<string> {
  // Chúng ta giới hạn text tài liệu để tránh quá tải Token
  const context = text.substring(0, 20000); 

  const prompt = `Bạn là một trợ lý học tập thông minh tên là Buddy. 
  Dựa trên nội dung tài liệu dưới đây, hãy trả lời câu hỏi của người dùng một cách chi tiết và dễ hiểu.
  Nếu thông tin không có trong tài liệu, hãy nói rằng bạn không biết dựa trên tài liệu này nhưng có thể giải thích dựa trên kiến thức chung.

  Nội dung tài liệu: ${context}
  
  Câu hỏi của người dùng: ${question}`;

  try {
    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    this.logger.error(`❌ Lỗi Gemini Chat: ${error.message}`);
    throw new Error('Không thể kết nối với Gemini để chat.');
  }
}
  async generateQuiz(text: string): Promise<QuizQuestion[]> {
    const prompt = `Dựa trên nội dung sau, hãy tạo 5 câu hỏi trắc nghiệm bằng tiếng Việt.

YÊU CẦU QUAN TRỌNG: Chỉ trả về duy nhất mảng JSON, không có lời dẫn, không có dấu \`\`\`json.
Định dạng bắt buộc:
[
  {
    "question": "Câu hỏi là gì?",
    "options": { "A": "Đáp án 1", "B": "Đáp án 2", "C": "Đáp án 3", "D": "Đáp án 4" },
    "correctAnswer": "A",
    "explanation": "Giải thích chi tiết tại sao A đúng"
  }
]

Nội dung: \${text.substring(0, 15000)}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let rawText = response.text();

      // ✅ Mẹo: Dùng Regex để tìm đúng mảng JSON [ ... ] đề phòng Gemini trả về văn bản thừa
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Không tìm thấy định dạng JSON trong phản hồi của AI');
      }

      const questions: QuizQuestion[] = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Dữ liệu Quiz không phải là mảng hợp lệ');
      }

      return questions;
    } catch (error) {
      this.logger.error(`❌ Lỗi Gemini Quiz: ${error.message}`);
      throw new Error(`Gemini Quiz thất bại: ${error.message}`);
    }
  }
}