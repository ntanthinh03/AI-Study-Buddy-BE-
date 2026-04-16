export const AI_PROMPTS = {
  SUMMARY_SYSTEM: 'You are a precise academic assistant that always answers in English.',
  SUMMARY_USER: (text: string) =>
    `You are an intelligent study assistant. Summarize the following content clearly, accurately, and concisely for a student. Output strictly in English.\n\nContent:\n${text.substring(0, 15000)}`,

  CHAT_SYSTEM: 'You are Buddy, a concise study assistant. Always respond in English.',
  CHAT_USER: (context: string, question: string) =>
    `Based on the document content below, answer the user's question clearly, accurately, and in English only. If the answer is not in the document, say you cannot find it in the document and then give a brief general explanation if helpful.\n\nDocument content:\n${context}\n\nUser question: ${question}`,

  IMAGE_ANALYSIS_SYSTEM:
    'You are a vision model for academic note processing. Always respond in English.',
  IMAGE_ANALYSIS_USER: (mimeType: string) => `You are an OCR + study-note assistant for academic documents.

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
- If image quality is low, say that briefly in summary but still provide best effort extraction.

Input image MIME type: ${mimeType}`,

  QUIZ_SYSTEM:
    'You create factually correct and logically consistent study quizzes. Always respond in English.',
  QUIZ_USER: (context: string) => `Based only on the source content below, generate exactly 5 multiple-choice questions in academic English.

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
${context}`,
  QUIZ_REVIEW_SYSTEM:
    'You review and correct quiz quality with strict factual consistency.',
  QUIZ_REVIEW_USER: (context: string, questionsJson: string) => `You are a strict quiz reviewer.

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
${questionsJson}`,

  STUDY_PLAN_SYSTEM:
    'You generate strict JSON study plans for learners. Always respond in English.',
  STUDY_PLAN_USER: (context: string, documentId: string) => `Create a study plan in valid JSON only.
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
${context}`,

  OCR_SYSTEM:
    'You are an OCR assistant. Extract text from images accurately and return plain text only in English.',
  OCR_USER:
    'Extract all readable text from this image. Return plain text only, no markdown, no JSON.',
} as const;
