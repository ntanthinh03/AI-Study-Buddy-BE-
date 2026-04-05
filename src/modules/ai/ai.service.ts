import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Ollama } from "@langchain/ollama";
import { RagService } from '../rag/rag.service';

@Injectable()
export class AiService {
  private model = new Ollama({
    baseUrl: "http://localhost:11434",
    model: "phi3:medium-128k",
    temperature: 0.3,
    repeatPenalty: 1.1,
  });

  constructor(private readonly ragService: RagService) {}

  async generateResponse(question: string) {
    try {
      const { context, sources } = await this.ragService.getRelevantContext(question);

      const prompt = `
        <|system|>
        You are an elite AI Study Buddy. Your task is to provide accurate, helpful, and concise answers based strictly on the provided context.
        If the context does not contain the answer, politely inform the student.
        <|end|>
        <|user|>
        Context: ${context}
        Question: ${question}
        <|end|>
        <|assistant|>
      `;

      const response = await (this.model as any).invoke(prompt);

      return {
        answer: response.trim(),
        sources: sources
      };
    } catch (error) {
      throw new InternalServerErrorException("Generation process failed.");
    }
  }
}