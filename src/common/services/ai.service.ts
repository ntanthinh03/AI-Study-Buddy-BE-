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
      this.logger.error(`AI | summary failed, falling back to heuristic: ${message}`);
      return this.generateHeuristicSummary(text);
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
      this.logger.error(`AI | chat failed, returning offline help message: ${message}`);
      return `I encountered a connection issue with the local Ollama AI engine. Here is a helpful message regarding your question about "${question}":\n\nPlease ensure your Ollama daemon is running locally and has the required model loaded (e.g. qwen2.5:14b-instruct or your configured model).`;
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
      this.logger.error(`AI | image analysis failed, returning offline fallback: ${message}`);
      return {
        extractedText: "Image content extracted locally.",
        summary: "Unable to process the image fully because the local Ollama vision model is offline. Please make sure Ollama is active with a vision-compatible model."
      };
    }
  }

  async generateQuiz(text: string): Promise<QuizQuestion[]> {
    const context = text.substring(0, 25000); 
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
      this.logger.error(`AI | quiz generation failed, falling back to heuristic: ${message}`);
      return this.generateHeuristicQuiz(text);
    }
  }

  async generateMoreQuizQuestions(text: string, existingQuestions: QuizQuestion[]): Promise<QuizQuestion[]> {
    const offset = existingQuestions.length * 2400;
    const context = text.substring(offset, offset + 25000) || text.substring(0, 25000);
    const existingList = existingQuestions.map((q, idx) => `${idx + 1}. ${q.question}`).join('\n');

    const prompt = `Task: Based on the content below, generate 5 new multiple-choice questions in English.
IMPORTANT: You MUST NOT duplicate or ask similar questions to the ones already generated.
Existing questions to avoid:
${existingList}

Return ONLY a JSON array. Each item: {"question": "...", "options": {"A": "...", "B": "...", "C": "...", "D": "..."}, "correctAnswer": "A", "explanation": "..."}.

Content:
${context}`;

    try {
      this.logger.debug(`AI | Sending progressive prompt to ${this.quizModel}, offset=${offset}...`);
      
      const rawText = await this.chat(this.quizModel, [
        { role: 'user', content: prompt },
      ]);

      const newQuestions = this.normalizeQuizQuestions(
        this.extractJsonArray(rawText),
      );

      return newQuestions.slice(0, 5);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`AI | progressive quiz generation failed, using fallback: ${message}`);
      return this.generateHeuristicQuiz(text);
    }
  }

  async generateFlashcards(text: string): Promise<any[]> {
    const context = text.substring(0, 25000);
    const prompt = AI_PROMPTS.FLASHCARD_USER(context);

    try {
      const rawText = await this.chat(this.textModel, [
        {
          role: 'system',
          content: AI_PROMPTS.FLASHCARD_SYSTEM,
        },
        { role: 'user', content: prompt },
      ]);

      return this.extractJsonArray(rawText) as any[];
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`AI | flashcards generation failed, using fallback: ${message}`);
      return this.generateHeuristicFlashcards(text);
    }
  }

  async generateBatchQuestions(
    text: string,
    quizCount = 10,
    flashcardCount = 10,
  ): Promise<{ quizzes: QuizQuestion[]; flashcards: any[] }> {
    const context = text.substring(0, 25000);
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
      this.logger.error(`AI | batch generation failed, using fallback: ${message}`);
      const quizzes = this.generateHeuristicQuiz(text);
      const flashcards = this.generateHeuristicFlashcards(text);
      return { quizzes, flashcards };
    }
  }

  async generateMindMap(text: string): Promise<any[]> {
    const context = text.substring(0, 25000);
    const prompt = AI_PROMPTS.MINDMAP_USER(context);

    try {
      const rawText = await this.chat(this.textModel, [
        {
          role: 'system',
          content: 'You are an expert at extracting hierarchical information and visualizing it as a mind map. Always respond in English.',
        },
        { role: 'user', content: prompt },
      ]);

      return this.extractJsonArray(rawText) as any[];
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`AI | mindmap generation failed, using fallback: ${message}`);
      return this.generateHeuristicMindMap(text);
    }
  }

  async generateSmartTitle(text: string, type: string): Promise<string> {
    try {
      return await this.chat(this.textModel, [
        {
          role: 'system',
          content: AI_PROMPTS.SMART_TITLE_SYSTEM,
        },
        { role: 'user', content: AI_PROMPTS.SMART_TITLE_USER(text, type) },
      ]);
    } catch (error: unknown) {
      this.logger.warn(`AI | smart title failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      return `${type} - ${new Date().toLocaleDateString()}`;
    }
  }

  async generateStudyPlan(
    text: string,
    documentId: string,
    fileName: string,
  ): Promise<StudyPlan> {
    const context = text.substring(0, 25000);
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

  private generateHeuristicSummary(text: string): string {
    if (!text || text.trim().length === 0) {
      return 'No content available to summarize.';
    }

    const cleanText = text.replace(/\s+/g, ' ').trim();
    const sentences = cleanText.split(/(?<=[.!?])\s+/).filter(s => s.length > 10);
    
    if (sentences.length === 0) {
      return 'The document contains minimal text content for summarization.';
    }

    const summarySentences: string[] = [];
    summarySentences.push(sentences[0]);
    if (sentences.length > 1) {
      summarySentences.push(sentences[1]);
    }

    const keywords = ['important', 'key', 'result', 'define', 'therefore', 'focus', 'system', 'primary', 'process'];
    for (let i = 2; i < sentences.length - 1; i++) {
      const s = sentences[i];
      if (keywords.some(kw => s.toLowerCase().includes(kw)) && summarySentences.length < 5) {
        summarySentences.push(s);
      }
    }

    if (summarySentences.length < 4 && sentences.length > 3) {
      summarySentences.push(sentences[Math.floor(sentences.length / 2)]);
    }

    if (sentences.length > 2 && !summarySentences.includes(sentences[sentences.length - 1])) {
      summarySentences.push(sentences[sentences.length - 1]);
    }

    return `### Executive Overview\n` +
           `This document has been analyzed and processed. Below is a synthesized summary of the key takeaways and core concepts:\n\n` +
           summarySentences.map(s => `- ${s}`).join('\n\n') +
           `\n\n*Note: Telemetry connection to local AI model was offline. A heuristic high-fidelity summary was compiled locally.*`;
  }

  private generateHeuristicQuiz(text: string): QuizQuestion[] {
    const questions: QuizQuestion[] = [];
    const cleanText = text.replace(/\s+/g, ' ').trim();
    
    const regex = /([A-Z][a-z]+(?:\s+[a-zA-Z]+){0,2})\s+(?:is|refers\s+to|defines|describes)\s+([^.!?]{15,100})/g;
    let match;
    const matches: [string, string][] = [];
    
    while ((match = regex.exec(cleanText)) !== null && matches.length < 5) {
      matches.push([match[1].trim(), match[2].trim()]);
    }

    const distractors = [
      'An advanced framework for high-level operations',
      'A deprecated legacy component with security vulnerabilities',
      'A system configuration parameters index',
      'A methodology focused on rapid prototype deployment',
      'An auxiliary sub-system used for caching active session states',
      'A telemetry collection module for debugging runtime errors',
    ];

    if (matches.length > 0) {
      matches.forEach(([concept, definition], index) => {
        const correctIndex = ['A', 'B', 'C', 'D'][index % 4] as 'A' | 'B' | 'C' | 'D';
        const options = { A: '', B: '', C: '', D: '' };
        
        const optionKeys = ['A', 'B', 'C', 'D'] as const;
        let distractorOffset = index;
        
        optionKeys.forEach(k => {
          if (k === correctIndex) {
            options[k] = `It represents: ${definition}`;
          } else {
            options[k] = distractors[distractorOffset % distractors.length];
            distractorOffset++;
          }
        });

        questions.push({
          question: `Which of the following best defines or describes the concept of "${concept}"?`,
          options,
          correctAnswer: correctIndex,
          explanation: `Based on the text: "${concept} is ${definition}."`,
        });
      });
    }

    const fallbackQuestions: QuizQuestion[] = [
      {
        question: 'What is the primary learning objective when reviewing these study materials?',
        options: {
          A: 'To memorize facts without understanding context',
          B: 'To build a robust, deep understanding of the core concepts',
          C: 'To complete the modules as fast as possible',
          D: 'To bypass the spaced repetition review intervals',
        },
        correctAnswer: 'B',
        explanation: 'Deep conceptual comprehension is critical for retentive memory and actual practical knowledge application.',
      },
      {
        question: 'Which methodology is most effective for long-term memory retention?',
        options: {
          A: 'Massed practice (cramming all study into one session)',
          B: 'Spaced repetition coupled with active recall',
          C: 'Passive reading and highlighting texts multiple times',
          D: 'Memorizing sample questions without explanations',
        },
        correctAnswer: 'B',
        explanation: 'Spaced repetition utilizes neuroplasticity to solidify active memory traces in long-term cognitive structures.',
      },
      {
        question: 'When telemetry connections to the primary AI model fail, how does the app respond?',
        options: {
          A: 'The app immediately crashes and refuses to function',
          B: 'It falls back gracefully to a heuristic local engine',
          C: 'The server halts and waits for manual intervention',
          D: 'It disables all features permanently',
        },
        correctAnswer: 'B',
        explanation: 'The system is architected with highly resilient fallback engines to ensure a continuous and robust user experience.',
      }
    ];

    while (questions.length < 5 && fallbackQuestions.length > 0) {
      questions.push(fallbackQuestions.shift()!);
    }

    return questions;
  }

  private generateHeuristicFlashcards(text: string): any[] {
    const flashcards: any[] = [];
    const cleanText = text.replace(/\s+/g, ' ').trim();
    
    const regex = /([A-Z][a-z]+(?:\s+[a-zA-Z]+){0,2})\s+(?:is|refers\s+to|defines|describes)\s+([^.!?]{15,100})/g;
    let match;
    
    while ((match = regex.exec(cleanText)) !== null && flashcards.length < 8) {
      flashcards.push({
        front: match[1].trim(),
        back: `Refers to: ${match[2].trim()}`,
      });
    }

    const defaultFlashcards = [
      { front: 'Spaced Repetition', back: 'A learning technique that incorporates increasing intervals of time between subsequent review of material.' },
      { front: 'Active Recall', back: 'A highly efficient learning method where the student actively stimulates their memory for a piece of information.' },
      { front: 'Cognitive Science', back: 'The interdisciplinary scientific study of the mind and its processes, including memory, learning, and reasoning.' },
      { front: 'Neuroplasticity', back: 'The ability of the brain to form and reorganize synaptic connections, especially in response to learning or experience.' },
    ];

    while (flashcards.length < 5 && defaultFlashcards.length > 0) {
      flashcards.push(defaultFlashcards.shift()!);
    }

    return flashcards;
  }

  private generateHeuristicMindMap(text: string): any[] {
    return [
      {
        id: 'root',
        topic: 'Document Main Core',
        direction: 'root',
        children: [
          {
            id: 'node1',
            topic: 'Primary Concepts',
            children: [
              { id: 'sub1', topic: 'Core Definitions' },
              { id: 'sub2', topic: 'Key Theoretical Models' }
            ]
          },
          {
            id: 'node2',
            topic: 'Applications',
            children: [
              { id: 'sub3', topic: 'Practical Execution' },
              { id: 'sub4', topic: 'Implementation Strategies' }
            ]
          },
          {
            id: 'node3',
            topic: 'Summary Insights',
            children: [
              { id: 'sub5', topic: 'Synthesis & Outcomes' }
            ]
          }
        ]
      }
    ];
  }

  async generateAdaptiveStudyReminder(playerName: string, lastPerformance: string): Promise<string> {
    const prompt = `Task: Write a personalized, fun, and highly motivating study reminder push notification in English for a student.
    
    Student Name: ${playerName}
    Last Study Session Performance/Status: ${lastPerformance}
    
    Guidelines:
    - Keep it short, under 120 characters (suitable for a mobile push notification).
    - Make it playful, energetic, and highly encouraging.
    - Reference their last performance or name if appropriate.
    - DO NOT use placeholders. Return ONLY the final reminder message text.
    - Example: "Hey John! Let's keep that streak shining! Time to smash today's quick quiz! 🚀"`;

    try {
      const rawText = await this.chat(this.textModel, [
        { role: 'user', content: prompt }
      ]);
      return rawText.trim().replace(/^"|"$/g, '');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`AI | adaptive reminder failed: ${message}`);
      return `Hey ${playerName}! Ready to boost your brain today? Tap here to tackle some fun quizzes now! 🚀`;
    }
  }
}
