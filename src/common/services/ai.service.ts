import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeOllamaBaseUrl } from '../config/ollama.config';
import { AI_MESSAGES } from '../constants/messages';
import { AI_PROMPTS } from '../constants/ai-prompts';
import { RagService } from '../../modules/rag/rag.service';

export interface QuizQuestion {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}

export interface StudyPlanModule {
  moduleId: string;
  order: number;
  documentId: string;
  title: string;
  objective: string;
  estimatedMinutes: number;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  status: 'LOCKED' | 'IN_PROGRESS' | 'COMPLETED';
  quiz: {
    recommendedQuestionCount: number;
    passScore: number;
  };
}

export interface StudyPlan {
  planId: string;
  title: string;
  overview: string;
  estimatedTotalMinutes: number;
  modules: StudyPlanModule[];
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
  private readonly quizModel: string;
  private readonly visionModel: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly ragService: RagService,
  ) {
    this.baseUrl = normalizeOllamaBaseUrl(
      this.configService.get<string>('OLLAMA_BASE_URL'),
    );
    this.textModel =
      this.configService.get<string>('OLLAMA_TEXT_MODEL') ??
      'qwen2.5:14b-instruct';
    this.quizModel =
      this.configService.get<string>('OLLAMA_QUIZ_MODEL') ?? this.textModel;
    this.visionModel =
      this.configService.get<string>('OLLAMA_VISION_MODEL') ??
      'llama3.2-vision:11b';
  }

  async generateRagResponse(question: string) {
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

      const answer = await this.chat(this.textModel, [
        { role: 'user', content: prompt }
      ]);

      return {
        answer: answer.trim(),
        sources: sources,
      };
    } catch (error: unknown) {
      this.logger.error(`AI | RAG generation failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      throw new InternalServerErrorException(AI_MESSAGES.GENERATION_FAILED);
    }
  }

  async generateSummary(text: string): Promise<string> {
    const prompt = AI_PROMPTS.SUMMARY_USER(text);

    try {
      return await this.chat(this.textModel, [
        {
          role: 'system',
          content: AI_PROMPTS.SUMMARY_SYSTEM,
        },
        { role: 'user', content: prompt },
      ]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`AI | summary failed: ${message}`);
      throw new Error(`${AI_MESSAGES.SUMMARY_FAILED}${message}`);
    }
  }

  async chatWithDocument(text: string, question: string): Promise<string> {
    const context = text.substring(0, 20000);
    const prompt = AI_PROMPTS.CHAT_USER(context, question);

    try {
      return await this.chat(this.textModel, [
        {
          role: 'system',
          content: AI_PROMPTS.CHAT_SYSTEM,
        },
        { role: 'user', content: prompt },
      ]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`AI | chat failed: ${message}`);
      throw new Error(AI_MESSAGES.CHAT_FAILED);
    }
  }

  async analyzeImageAndSummarize(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<{ extractedText: string; summary: string }> {
    const imageBase64 = imageBuffer.toString('base64');
    const promptWithMimeType = AI_PROMPTS.IMAGE_ANALYSIS_USER(mimeType);

    try {
      const rawText = await this.chat(this.visionModel, [
        {
          role: 'system',
          content: AI_PROMPTS.IMAGE_ANALYSIS_SYSTEM,
        },
        {
          role: 'user',
          content: promptWithMimeType,
          images: [imageBase64],
        },
      ]);

      const parsed = this.extractJsonObject(rawText);
      const extractedText =
        typeof parsed.extractedText === 'string' &&
        parsed.extractedText.trim().length > 0
          ? parsed.extractedText.trim()
          : rawText.trim();
      const summary =
        typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
          ? parsed.summary.trim()
          : rawText.trim();

      return { extractedText, summary };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`AI | image analysis failed: ${message}`);
      throw new Error(`${AI_MESSAGES.IMAGE_ANALYSIS_FAILED}${message}`);
    }
  }

  async generateQuiz(text: string): Promise<QuizQuestion[]> {
    const context = text.substring(0, 5000); // Giảm xuống 5000 để nhẹ máy hơn
    const prompt = `Task: Based on the content below, generate 5 multiple-choice questions in English. 
Return ONLY a JSON array. Each item: {"question": "...", "options": {"A": "...", "B": "...", "C": "...", "D": "..."}, "correctAnswer": "A", "explanation": "..."}.

Content:
${context}`;

    try {
      this.logger.debug(`AI | Sending simplified prompt to ${this.quizModel}...`);
      
      const rawText = await this.chat(this.quizModel, [
        { role: 'user', content: prompt },
      ]);

      this.logger.debug(`AI | Raw Quiz Response: ${rawText.substring(0, 500)}`);

      const initialQuestions = this.normalizeQuizQuestions(
        this.extractJsonArray(rawText),
      );

      return initialQuestions.slice(0, 5);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`AI | quiz generation failed: ${message}`);
      return [];
    }
  }

  async generateBatchQuestions(
    text: string,
    quizCount = 10,
    flashcardCount = 10,
  ): Promise<{ quizzes: QuizQuestion[]; flashcards: any[] }> {
    const context = text.substring(0, 15000);
    const prompt = AI_PROMPTS.BATCH_GEN_USER(context, quizCount, flashcardCount);

    try {
      const rawText = await this.chat(this.quizModel, [
        {
          role: 'system',
          content: AI_PROMPTS.BATCH_GEN_SYSTEM,
        },
        { role: 'user', content: prompt },
      ]);

      const parsed = this.extractJsonObject(rawText);
      const quizData = parsed.quizzes || parsed.quiz || [];
      const quizzes = this.normalizeQuizQuestions(
        Array.isArray(quizData) ? quizData : [],
      );
      const flashcards = Array.isArray(parsed.flashcards) ? parsed.flashcards : [];

      if (quizzes.length === 0 && (quizCount > 0)) {
        this.logger.warn(`AI | Batch generation returned 0 quizzes. Raw response snippet: ${rawText.substring(0, 200)}...`);
      }

      return { quizzes, flashcards };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`AI | batch generation failed: ${message}`);
      throw new Error(`${AI_MESSAGES.QUIZ_GENERATION_FAILED}${message}`);
    }
  }

  async generateMindMap(text: string): Promise<any[]> {
    const context = text.substring(0, 15000);
    const prompt = AI_PROMPTS.MINDMAP_USER(context);

    try {
      const rawText = await this.chat(this.textModel, [
        {
          role: 'system',
          content: AI_PROMPTS.MINDMAP_SYSTEM,
        },
        { role: 'user', content: prompt },
      ]);

      return this.extractJsonArray(rawText) as any[];
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`AI | mindmap generation failed: ${message}`);
      throw new Error(`Mindmap generation failed: ${message}`);
    }
  }

  async generateStudyPlan(
    text: string,
    documentId: string,
    fileName: string,
  ): Promise<StudyPlan> {
    const context = text.substring(0, 15000);
    const prompt = AI_PROMPTS.STUDY_PLAN_USER(context, documentId);

    const rawText = await this.chat(this.textModel, [
      {
        role: 'system',
        content: AI_PROMPTS.STUDY_PLAN_SYSTEM,
      },
      { role: 'user', content: prompt },
    ]);

    const parsed = this.extractJsonObject(rawText);
    return this.normalizeStudyPlan(parsed, documentId, fileName);
  }

  private normalizeStudyPlan(
    input: Record<string, unknown>,
    documentId: string,
    fileName: string,
  ): StudyPlan {
    const planId =
      typeof input.planId === 'string' && input.planId.trim()
        ? input.planId.trim()
        : `plan_${documentId}_${Date.now()}`;
    const title =
      typeof input.title === 'string' && input.title.trim()
        ? input.title.trim()
        : `Study Plan - ${fileName}`;
    const overview =
      typeof input.overview === 'string' && input.overview.trim()
        ? input.overview.trim()
        : 'Structured learning roadmap generated from the document.';

    const modulesRaw = Array.isArray(input.modules) ? input.modules : [];
    const modules: StudyPlanModule[] = modulesRaw
      .map((module, index) =>
        this.normalizeStudyPlanModule(module, documentId, index),
      )
      .filter((m): m is StudyPlanModule => Boolean(m));

    if (modules.length === 0) {
      modules.push({
        moduleId: `${documentId}-m1`,
        order: 1,
        documentId,
        title: 'Core Concepts',
        objective: 'Understand key concepts from the document',
        estimatedMinutes: 30,
        difficulty: 'BEGINNER',
        status: 'IN_PROGRESS',
        quiz: { recommendedQuestionCount: 5, passScore: 70 },
      });
    }

    const estimatedTotalMinutes = modules.reduce(
      (sum, m) => sum + m.estimatedMinutes,
      0,
    );

    return {
      planId,
      title,
      overview,
      estimatedTotalMinutes,
      modules,
    };
  }

  private normalizeStudyPlanModule(
    module: unknown,
    documentId: string,
    index: number,
  ): StudyPlanModule | null {
    if (!module || typeof module !== 'object') {
      return null;
    }

    const record = module as Record<string, unknown>;
    const order =
      typeof record.order === 'number' && record.order > 0
        ? Math.floor(record.order)
        : index + 1;
    const title =
      typeof record.title === 'string' && record.title.trim()
        ? record.title.trim()
        : `Module ${order}`;
    const objective =
      typeof record.objective === 'string' && record.objective.trim()
        ? record.objective.trim()
        : 'Review the key concepts and practice understanding.';
    const estimatedMinutes =
      typeof record.estimatedMinutes === 'number' && record.estimatedMinutes > 0
        ? Math.floor(record.estimatedMinutes)
        : 30;

    const difficultyRaw =
      typeof record.difficulty === 'string'
        ? record.difficulty.trim().toUpperCase()
        : 'BEGINNER';
    const difficulty = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(
      difficultyRaw,
    )
      ? (difficultyRaw as StudyPlanModule['difficulty'])
      : 'BEGINNER';

    const statusRaw =
      typeof record.status === 'string'
        ? record.status.trim().toUpperCase()
        : '';
    const status =
      statusRaw && ['LOCKED', 'IN_PROGRESS', 'COMPLETED'].includes(statusRaw)
        ? (statusRaw as StudyPlanModule['status'])
        : order === 1
          ? 'IN_PROGRESS'
          : 'LOCKED';

    const quizRaw =
      record.quiz && typeof record.quiz === 'object'
        ? (record.quiz as Record<string, unknown>)
        : {};
    const recommendedQuestionCount =
      typeof quizRaw.recommendedQuestionCount === 'number' &&
      quizRaw.recommendedQuestionCount > 0
        ? Math.floor(quizRaw.recommendedQuestionCount)
        : 5;
    const passScore =
      typeof quizRaw.passScore === 'number' && quizRaw.passScore > 0
        ? Math.floor(quizRaw.passScore)
        : 70;

    return {
      moduleId:
        typeof record.moduleId === 'string' && record.moduleId.trim()
          ? record.moduleId.trim()
          : `${documentId}-m${order}`,
      order,
      documentId,
      title,
      objective,
      estimatedMinutes,
      difficulty,
      status,
      quiz: {
        recommendedQuestionCount,
        passScore,
      },
    };
  }

  private extractJsonArray(rawText: string): unknown[] {
    const jsonMatch = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!jsonMatch) {
      // Thử tìm mảng đơn giản hơn nếu mảng phức tạp thất bại
      const simplerMatch = rawText.match(/\[[\s\S]*\]/);
      if (!simplerMatch) throw new Error(AI_MESSAGES.NO_JSON_ARRAY);
      try {
        return JSON.parse(simplerMatch[0]) as unknown[];
      } catch {
        throw new Error(AI_MESSAGES.QUIZ_OUTPUT_NOT_ARRAY);
      }
    }

    try {
      return JSON.parse(jsonMatch[0]) as unknown[];
    } catch {
      throw new Error(AI_MESSAGES.QUIZ_OUTPUT_NOT_ARRAY);
    }
  }

  private normalizeQuizQuestions(input: unknown[]): QuizQuestion[] {
    const normalized: QuizQuestion[] = [];
    const seenQuestions = new Set<string>();

    for (const item of input) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const record = item as Record<string, unknown>;
      const question =
        typeof record.question === 'string' ? record.question.trim() : '';
      const explanation =
        typeof record.explanation === 'string' ? record.explanation.trim() : 'No explanation provided.';
      const correctAnswer =
        typeof record.correctAnswer === 'string'
          ? record.correctAnswer.trim().toUpperCase()
          : '';
      const optionsRaw = record.options;

      if (
        !question ||
        !['A', 'B', 'C', 'D'].includes(correctAnswer)
      ) {
        this.logger.warn(`AI | Skipping invalid question structure: ${question.substring(0, 50)}...`);
        continue;
      }

      if (!optionsRaw || typeof optionsRaw !== 'object') {
        continue;
      }

      const optionsRecord = optionsRaw as Record<string, unknown>;
      const optionA =
        typeof optionsRecord.A === 'string' ? optionsRecord.A.trim() : '';
      const optionB =
        typeof optionsRecord.B === 'string' ? optionsRecord.B.trim() : '';
      const optionC =
        typeof optionsRecord.C === 'string' ? optionsRecord.C.trim() : '';
      const optionD =
        typeof optionsRecord.D === 'string' ? optionsRecord.D.trim() : '';

      if (!optionA || !optionB || !optionC || !optionD) {
        continue;
      }

      const uniqueOptions = new Set([optionA, optionB, optionC, optionD]);
      if (uniqueOptions.size < 4) {
        continue;
      }

      const dedupeKey = question.toLowerCase();
      if (seenQuestions.has(dedupeKey)) {
        continue;
      }
      seenQuestions.add(dedupeKey);

      normalized.push({
        question,
        options: { A: optionA, B: optionB, C: optionC, D: optionD },
        correctAnswer: correctAnswer as QuizQuestion['correctAnswer'],
        explanation,
      });
    }

    return normalized;
  }

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
        options: {
          temperature: 0,
          top_p: 0.1,
          num_predict: 2000,
        },
      }),
    });
  }

  private async chat(
    model: string,
    messages: OllamaChatMessage[],
  ): Promise<string> {
    try {
      const response = await this.requestChat(this.baseUrl, model, messages);
      return await this.parseChatResponse(response);
    } catch (primaryError: unknown) {
      const fallbackBaseUrl = this.getFallbackBaseUrl();
      if (!fallbackBaseUrl) {
        throw primaryError;
      }

      try {
        const response = await this.requestChat(
          fallbackBaseUrl,
          model,
          messages,
        );
        const content = await this.parseChatResponse(response);
        this.logger.warn(`AI | fallback recovered: ${fallbackBaseUrl}`);
        return content;
      } catch (fallbackError: unknown) {
        const primaryMessage =
          primaryError instanceof Error
            ? primaryError.message
            : 'Unknown error';
        const fallbackMessage =
          fallbackError instanceof Error
            ? fallbackError.message
            : 'Unknown error';
        throw new Error(
          `Ollama request failed: primary=${primaryMessage}; fallback=${fallbackMessage}`,
        );
      }
    }
  }

  private async parseChatResponse(response: Response): Promise<string> {
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Ollama request failed (${response.status}): ${errorText}`,
      );
    }

    const data = (await response.json()) as OllamaChatResponse;
    const content = data.message?.content ?? data.response ?? '';

    if (!content.trim()) {
      throw new Error(AI_MESSAGES.MODEL_RETURNED_EMPTY_CONTENT);
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
      const normalized = match[0].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

      try {
        return JSON.parse(normalized) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
  }
}
