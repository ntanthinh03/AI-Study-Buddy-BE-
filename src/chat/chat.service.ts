import { Injectable, Logger } from '@nestjs/common';

type OllamaChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly baseUrl = (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/$/, '');
  private readonly model = process.env.OLLAMA_TEXT_MODEL ?? 'qwen2.5:14b-instruct';

  async getAIResponse(prompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a concise study assistant. Always answer in English.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ] satisfies OllamaChatMessage[],
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed (${response.status})`);
      }

      const data = (await response.json()) as { message?: { content?: string }; response?: string };
      const answer = data.message?.content ?? data.response ?? '';

      if (!answer.trim()) {
        throw new Error('Local model returned empty response');
      }

      return answer;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Local chat failed: ${message}`);
      throw new Error('Local AI chat failed.');
    }
  }
}