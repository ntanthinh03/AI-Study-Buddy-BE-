import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Ollama } from '@langchain/ollama';
import { RagService } from '../rag/rag.service';

interface OllamaLike {
  invoke(prompt: string): Promise<unknown>;
}

@Injectable()
export class AiService {
  private readonly model: OllamaLike = new Ollama({
    baseUrl: 'http://localhost:11434',
    model: 'phi3:medium-128k',
    temperature: 0.3,
    repeatPenalty: 1.1,
  }) as unknown as OllamaLike;

  constructor(private readonly ragService: RagService) {}

  async generateResponse(question: string) {
    try {
      const { context, sources } =
        await this.ragService.getRelevantContext(question);

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

      const response = await this.model.invoke(prompt);
      const answer = this.normalizeResponseText(response);

      return {
        answer,
        sources: sources,
      };
    } catch {
      throw new InternalServerErrorException('Generation process failed.');
    }
  }

  private normalizeResponseText(response: unknown): string {
    if (typeof response === 'string') {
      return response.trim();
    }

    if (response && typeof response === 'object') {
      const record = response as {
        content?: unknown;
        message?: { content?: unknown };
      };

      if (typeof record.content === 'string') {
        return record.content.trim();
      }

      if (typeof record.message?.content === 'string') {
        return record.message.content.trim();
      }

      return '';
    }

    if (response === null || response === undefined) {
      return '';
    }

    if (typeof response === 'string') {
      return response.trim();
    }

    if (
      typeof response === 'number' ||
      typeof response === 'boolean' ||
      typeof response === 'bigint'
    ) {
      return response.toString().trim();
    }

    return '';
  }
}
