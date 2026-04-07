import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface QuizQuestion {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}

type OllamaChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
};

type OllamaChatResponse = {
  message?: {
    role?: string;
    content?: string;
  };
  response?: string;
  error?: string;
};

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly baseUrl: string;
  private readonly textModel: string;
  private readonly visionModel: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = (this.configService.get<string>('OLLAMA_BASE_URL') ?? 'http://localhost:11434').replace(/\/$/, '');
    this.textModel = this.configService.get<string>('OLLAMA_TEXT_MODEL') ?? 'qwen2.5:14b-instruct';
    this.visionModel = this.configService.get<string>('OLLAMA_VISION_MODEL') ?? 'llama3.2-vision:11b';
  }

  async generateSummary(text: string): Promise<string> {
    const prompt = `You are an intelligent study assistant. Summarize the following content clearly, accurately, and concisely for a student. Output strictly in English.\n\nContent:\n${text.substring(0, 15000)}`;

    try {
      return await this.chat(this.textModel, [
        { role: 'system', content: 'You are a precise academic assistant that always answers in English.' },
        { role: 'user', content: prompt },
      ]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Local summary failed: ${message}`);
      throw new Error(`Local summary failed: ${message}`);
    }
  }

  async chatWithDocument(text: string, question: string): Promise<string> {
    const context = text.substring(0, 20000);
    const prompt = `Based on the document content below, answer the user's question clearly, accurately, and in English only. If the answer is not in the document, say you cannot find it in the document and then give a brief general explanation if helpful.\n\nDocument content:\n${context}\n\nUser question: ${question}`;

    try {
      return await this.chat(this.textModel, [
        { role: 'system', content: 'You are Buddy, a concise study assistant. Always respond in English.' },
        { role: 'user', content: prompt },
      ]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Local chat failed: ${message}`);
      throw new Error('Could not connect to the local AI model for chat.');
    }
  }

  async analyzeImageAndSummarize(imageBuffer: Buffer, mimeType: string): Promise<{ extractedText: string; summary: string }> {
    const imageBase64 = imageBuffer.toString('base64');
    const prompt = `You are an OCR + study-note assistant for academic documents.

Task:
1) Read the image and extract study-relevant content as accurately as possible.
2) Return ONLY valid JSON (no markdown, no code fences, no extra text).

Output JSON schema (exactly these keys):
{
  "extractedText": "...",
  "summary": "..."
}

Rules:
- Output must be strictly in English.
- Keep math formulas readable using plain text math notation.
- Preserve key terms, headings, bullet points, and definitions when visible.
- If text is partially unreadable, keep high-confidence text and avoid hallucination.
- "extractedText" should be a clean OCR reconstruction (multi-line allowed).
- "summary" should be concise, factual, and optimized for student review.
- If image quality is low, say that briefly in summary but still provide best effort extraction.`;

    try {
      const rawText = await this.chat(this.visionModel, [
        { role: 'system', content: 'You are a vision model for academic note processing. Always respond in English.' },
        {
          role: 'user',
          content: prompt,
          images: [imageBase64],
        },
      ]);

      const parsed = this.extractJsonObject(rawText);
      const extractedText = typeof parsed.extractedText === 'string' && parsed.extractedText.trim().length > 0
        ? parsed.extractedText.trim()
        : rawText.trim();
      const summary = typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
        ? parsed.summary.trim()
        : rawText.trim();

      return { extractedText, summary };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Local image analysis failed: ${message}`);
      throw new Error(`Local image analysis failed: ${message}`);
    }
  }

  async generateQuiz(text: string): Promise<QuizQuestion[]> {
    const prompt = `Based on the content below, generate 5 multiple-choice questions in English only.\n\nIMPORTANT: Return only a valid JSON array, without markdown, without code fences, and without extra text.\nFormat:\n[\n  {\n    "question": "What is ...?",\n    "options": { "A": "...", "B": "...", "C": "...", "D": "..." },\n    "correctAnswer": "A",\n    "explanation": "..."\n  }\n]\n\nContent:\n${text.substring(0, 15000)}`;

    try {
      const rawText = await this.chat(this.textModel, [
        { role: 'system', content: 'You create precise study quizzes and always respond in English.' },
        { role: 'user', content: prompt },
      ]);

      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in AI response');
      }

      const questions: QuizQuestion[] = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Quiz output is not a valid array');
      }

      return questions;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Local quiz generation failed: ${message}`);
      throw new Error(`Local quiz generation failed: ${message}`);
    }
  }

  private async chat(model: string, messages: OllamaChatMessage[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama request failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    const content = data.message?.content ?? data.response ?? '';

    if (!content.trim()) {
      throw new Error('Local model returned empty content');
    }

    return content;
  }

  private extractJsonObject(rawText: string): Record<string, unknown> {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) {
      return {};
    }

    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      // Try a relaxed fallback in case the model adds trailing commas.
      const normalized = match[0]
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');

      try {
        return JSON.parse(normalized) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
  }
}
