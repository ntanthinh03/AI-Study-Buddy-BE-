
import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from "@google/generative-ai";

@Injectable()
export class ChatService {
    constructor() {
        // 🔍 In ra độ dài của Key để kiểm tra
        const key = process.env.GEMINI_API_KEY;
        console.log('API Key loaded:', key ? `Yes (Length: ${key.length})` : 'NO - It is undefined');
    }
  private genAI = new GoogleGenerativeAI("YOUR_API_KEY");

  async getAIResponse(prompt: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }
}