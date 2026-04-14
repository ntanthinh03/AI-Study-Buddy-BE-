import { Injectable, Logger } from '@nestjs/common';

type OllamaChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly baseUrl = (
    process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
  ).replace(/\/$/, '');
  private readonly model =
    process.env.OLLAMA_TEXT_MODEL ?? 'qwen2.5:14b-instruct';

  private getFallbackBaseUrl(): string | null {
    if (this.baseUrl.includes('localhost')) {
      return this.baseUrl.replace('localhost', '127.0.0.1');
    }
    return null;
  }

  private async requestChat(
    baseUrl: string,
    prompt: string,
  ): Promise<Response> {
    return fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are a concise study assistant. Always answer in English.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ] satisfies OllamaChatMessage[],
        stream: false,
      }),
    });
  }

  async getAIResponse(prompt: string): Promise<string> {
    try {
      const response = await this.requestChat(this.baseUrl, prompt);
      return await this.parseResponse(response);
    } catch (primaryError: unknown) {
      const fallbackBaseUrl = this.getFallbackBaseUrl();
      if (!fallbackBaseUrl) {
        const message =
          primaryError instanceof Error
            ? primaryError.message
            : 'Unknown error';
        this.logger.error(`Local chat failed: ${message}`);
        throw new Error('Local AI chat failed.');
      }

      try {
        const response = await this.requestChat(fallbackBaseUrl, prompt);
        const answer = await this.parseResponse(response);
        this.logger.warn(
          `Ollama request recovered with fallback base URL: ${fallbackBaseUrl}`,
        );
        return answer;
      } catch (fallbackError: unknown) {
        const primaryMessage =
          primaryError instanceof Error
            ? primaryError.message
            : 'Unknown error';
        const fallbackMessage =
          fallbackError instanceof Error
            ? fallbackError.message
            : 'Unknown error';
        this.logger.error(
          `Local chat failed: primary=${primaryMessage}; fallback=${fallbackMessage}`,
        );
        throw new Error('Local AI chat failed.');
      }
    }
  }

  private async parseResponse(response: Response): Promise<string> {
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Ollama request failed (${response.status}): ${errorText}`,
      );
    }

    const data = (await response.json()) as {
      message?: { content?: string };
      response?: string;
    };
    const answer = data.message?.content ?? data.response ?? '';

    if (!answer.trim()) {
      throw new Error('Local model returned empty response');
    }

    return answer;
  }
}
