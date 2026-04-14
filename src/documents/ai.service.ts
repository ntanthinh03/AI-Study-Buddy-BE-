import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = (
      this.configService.get<string>('OLLAMA_BASE_URL') ??
      'http://localhost:11434'
    ).replace(/\/$/, '');
    this.textModel =
      this.configService.get<string>('OLLAMA_TEXT_MODEL') ??
      'qwen2.5:14b-instruct';
    this.quizModel =
      this.configService.get<string>('OLLAMA_QUIZ_MODEL') ?? this.textModel;
    this.visionModel =
      this.configService.get<string>('OLLAMA_VISION_MODEL') ??
      'llama3.2-vision:11b';
  }

  async generateSummary(text: string): Promise<string> {
    const prompt = `You are an intelligent study assistant. Summarize the following content clearly, accurately, and concisely for a student. Output strictly in English.\n\nContent:\n${text.substring(0, 15000)}`;

    try {
      return await this.chat(this.textModel, [
        {
          role: 'system',
          content:
            'You are a precise academic assistant that always answers in English.',
        },
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
        {
          role: 'system',
          content:
            'You are Buddy, a concise study assistant. Always respond in English.',
        },
        { role: 'user', content: prompt },
      ]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Local chat failed: ${message}`);
      throw new Error('Could not connect to the local AI model for chat.');
    }
  }

  async analyzeImageAndSummarize(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<{ extractedText: string; summary: string }> {
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

    const promptWithMimeType = `${prompt}\n\nInput image MIME type: ${mimeType}`;

    try {
      const rawText = await this.chat(this.visionModel, [
        {
          role: 'system',
          content:
            'You are a vision model for academic note processing. Always respond in English.',
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
      this.logger.error(`❌ Local image analysis failed: ${message}`);
      throw new Error(`Local image analysis failed: ${message}`);
    }
  }

  async generateQuiz(text: string): Promise<QuizQuestion[]> {
    const context = text.substring(0, 15000);
    const prompt = `Based only on the source content below, generate exactly 5 multiple-choice questions in academic English.

STRICT RULES:
- Return only a valid JSON array.
- No markdown, no code fences, no extra text.
- Each question must test meaningful understanding, not trivial wording.
- Exactly 4 options: A, B, C, D.
- Exactly one correct answer key in correctAnswer.
- correctAnswer must match the truly correct option based on the source.
- explanation must briefly justify why the correct option is right and why common confusion may happen.
- Avoid ambiguous, trick, or logically inconsistent questions.

Required format:
[
  {
    "question": "...",
    "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
    "correctAnswer": "A",
    "explanation": "..."
  }
]

Source content:
${context}`;

    try {
      const rawText = await this.chat(this.quizModel, [
        {
          role: 'system',
          content:
            'You create factually correct and logically consistent study quizzes. Always respond in English.',
        },
        { role: 'user', content: prompt },
      ]);

      const initialQuestions = this.normalizeQuizQuestions(
        this.extractJsonArray(rawText),
      );
      const reviewedQuestions = await this.reviewQuizQuestions(
        context,
        initialQuestions,
      );

      if (reviewedQuestions.length === 0) {
        throw new Error('Quiz generation returned no valid questions');
      }

      return reviewedQuestions.slice(0, 5);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Local quiz generation failed: ${message}`);
      throw new Error(`Local quiz generation failed: ${message}`);
    }
  }

  async generateStudyPlan(
    text: string,
    documentId: string,
    fileName: string,
  ): Promise<StudyPlan> {
    const context = text.substring(0, 15000);
    const prompt = `Create a study plan in valid JSON only.
Schema:
{
  "planId": "string",
  "title": "string",
  "overview": "string",
  "estimatedTotalMinutes": 0,
  "modules": [
    {
      "moduleId": "string",
      "order": 1,
      "documentId": "${documentId}",
      "title": "string",
      "objective": "string",
      "estimatedMinutes": 0,
      "difficulty": "BEGINNER|INTERMEDIATE|ADVANCED",
      "status": "LOCKED|IN_PROGRESS|COMPLETED",
      "quiz": {
        "recommendedQuestionCount": 5,
        "passScore": 70
      }
    }
  ]
}
Rules:
- Output English only.
- No markdown.
- No code fences.
- No extra text outside JSON.
- Use documentId exactly as provided.
- First module should be IN_PROGRESS, remaining modules should be LOCKED.

Source content:
${context}`;

    const rawText = await this.chat(this.textModel, [
      {
        role: 'system',
        content:
          'You generate strict JSON study plans for learners. Always respond in English.',
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

  private async reviewQuizQuestions(
    context: string,
    questions: QuizQuestion[],
  ): Promise<QuizQuestion[]> {
    if (questions.length === 0) {
      return [];
    }

    const prompt = `You are a strict quiz reviewer.

Task:
- Review the questions below against the source content.
- Fix any logical or factual mistakes.
- Ensure each question has one correct answer only.
- Keep exactly 5 items when possible.
- Keep the same JSON schema.
- Return only a valid JSON array and nothing else.

Source content:
${context}

Questions to review:
${JSON.stringify(questions)}`;

    const reviewedRaw = await this.chat(this.quizModel, [
      {
        role: 'system',
        content:
          'You review and correct quiz quality with strict factual consistency.',
      },
      { role: 'user', content: prompt },
    ]);

    const reviewedArray = this.extractJsonArray(reviewedRaw);
    const reviewedQuestions = this.normalizeQuizQuestions(reviewedArray);
    return reviewedQuestions.length > 0 ? reviewedQuestions : questions;
  }

  private extractJsonArray(rawText: string): unknown[] {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('Quiz output is not a valid array');
    }

    return parsed;
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
        typeof record.explanation === 'string' ? record.explanation.trim() : '';
      const correctAnswer =
        typeof record.correctAnswer === 'string'
          ? record.correctAnswer.trim().toUpperCase()
          : '';
      const optionsRaw = record.options;

      if (
        !question ||
        !explanation ||
        !['A', 'B', 'C', 'D'].includes(correctAnswer)
      ) {
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
        this.logger.warn(
          `Recovered Ollama call with fallback base URL: ${fallbackBaseUrl}`,
        );
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
      const normalized = match[0].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

      try {
        return JSON.parse(normalized) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
  }
}
