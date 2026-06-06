import { Injectable, Logger } from '@nestjs/common';
import { normalizeOllamaBaseUrl } from '../common/config/ollama.config';
import { CHAT_MESSAGES } from '../common/constants/messages';
import { AI_PROMPTS } from '../common/constants/ai-prompts';

type OllamaChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
};

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly baseUrl = normalizeOllamaBaseUrl(
    process.env.OLLAMA_BASE_URL,
  );
  private readonly model =
    process.env.OLLAMA_TEXT_MODEL ?? 'qwen2.5:14b-instruct';
  private readonly visionModel =
    process.env.OLLAMA_VISION_MODEL ?? 'llama3.2-vision:11b';

  private readonly visionModelHints = [
    'vision',
    'llava',
    'bakllava',
    'moondream',
  ];

  private getFallbackBaseUrl(): string | null {
    if (this.baseUrl.includes('localhost')) {
      return this.baseUrl.replace('localhost', '127.0.0.1');
    }
    return null;
  }

  private async requestChat(
    baseUrl: string,
    model: string,
    messages: OllamaChatMessage[],
  ): Promise<Response> {
    return fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
    });
  }

  async getAIResponse(prompt: string): Promise<string> {
    const messages: OllamaChatMessage[] = [
      {
        role: 'system',
        content: AI_PROMPTS.CHAT_SYSTEM,
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    return await this.executeWithFallback(this.model, messages);
  }

  async getAIImageResponse(
    question: string,
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const resolvedVisionModel = await this.resolveVisionModel();
    const imageBase64 = imageBuffer.toString('base64');
    const messages: OllamaChatMessage[] = [
      {
        role: 'system',
        content: AI_PROMPTS.IMAGE_ANALYSIS_SYSTEM,
      },
      {
        role: 'user',
        content: `Image MIME type: ${mimeType}\nQuestion: ${question}`,
        images: [imageBase64],
      },
    ];

    return await this.executeWithFallback(resolvedVisionModel, messages);
  }

  private async resolveVisionModel(): Promise<string> {
    const candidates = await this.fetchOllamaModelNames();
    if (candidates.length === 0) {
      return this.visionModel;
    }

    const exactMatch = candidates.find(
      (name) =>
        name === this.visionModel ||
        name === `${this.visionModel}:latest` ||
        name.split(':')[0] === this.visionModel,
    );
    if (exactMatch) {
      return exactMatch;
    }

    const fallback = candidates.find((name) =>
      this.visionModelHints.some((hint) => name.toLowerCase().includes(hint)),
    );

    return fallback ?? this.visionModel;
  }

  private async fetchOllamaModelNames(): Promise<string[]> {
    const baseUrls = [this.baseUrl, this.getFallbackBaseUrl()].filter(
      (v): v is string => Boolean(v),
    );

    for (const baseUrl of baseUrls) {
      try {
        const response = await fetch(`${baseUrl}/api/tags`);
        if (!response.ok) {
          continue;
        }

        const payload = (await response.json()) as {
          models?: Array<{ name?: string }>;
        };

        const names = (payload.models ?? [])
          .map((model) => model.name ?? '')
          .filter((name) => name.length > 0);

        if (names.length > 0) {
          return names;
        }
      } catch {
        continue;
      }
    }

    return [];
  }

  private async executeWithFallback(
    model: string,
    messages: OllamaChatMessage[],
  ): Promise<string> {
    try {
      const response = await this.requestChat(this.baseUrl, model, messages);
      return await this.parseResponse(response);
    } catch (primaryError: unknown) {
      const fallbackBaseUrl = this.getFallbackBaseUrl();
      if (!fallbackBaseUrl) {
        const message =
          primaryError instanceof Error
            ? primaryError.message
            : 'Unknown error';
        this.logger.error(`CHAT | failed: ${message}`);
          throw new Error(CHAT_MESSAGES.AI_CHAT_FAILED);
      }

      try {
        const response = await this.requestChat(
          fallbackBaseUrl,
          model,
          messages,
        );
        const answer = await this.parseResponse(response);
        this.logger.warn(`CHAT | fallback recovered: ${fallbackBaseUrl}`);
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
        this.logger.error(`CHAT | failed: ${primaryMessage}; ${fallbackMessage}`);
          throw new Error(CHAT_MESSAGES.AI_CHAT_FAILED);
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
        throw new Error(CHAT_MESSAGES.MODEL_RETURNED_EMPTY_RESPONSE);
    }

    return answer;
  }
}
