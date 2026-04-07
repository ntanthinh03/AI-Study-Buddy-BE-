# FE Guide - Structured Quiz Output (Professional Flow)

## Objective
Build a professional quiz experience (Kahoot-like) where:
1. AI returns structured JSON quiz data.
2. FE parses JSON into typed objects.
3. User taps `Start Quiz` from chat bubble.
4. App navigates to a dedicated quiz screen.
5. Quiz screen shows one question per page, computes score, and displays final result.

## 1) Structured Output Contract

### Recommended backend prompt (for AI generation)
Use a strict JSON-only prompt like this:

```text
Create a quiz in valid JSON only.
Schema:
{
  "questions": [
    {
      "id": 1,
      "text": "Question text",
      "options": ["A", "B", "C", "D"],
      "answer": "A",
      "explanation": "Short explanation"
    }
  ]
}
Rules:
- Output English only
- No markdown
- No code fences
- No extra text outside JSON
- Exactly 4 options per question
```

### FE expected response shape
```json
{
  "questions": [
    {
      "id": 1,
      "text": "What is the capital city of France?",
      "options": ["Madrid", "Paris", "London", "Berlin"],
      "answer": "Paris",
      "explanation": "Paris is the capital city of France."
    }
  ]
}
```

## 2) FE Data Models

Create FE models similar to:

```kotlin
data class QuizResponse(
    val questions: List<QuizQuestion>
)

data class QuizQuestion(
    val id: Int,
    val text: String,
    val options: List<String>,
    val answer: String,
    val explanation: String? = null
)
```

## 3) ViewModel Flow

### A. Generate quiz from chat action
- Trigger API when user requests quiz generation.
- Save raw response and parse immediately into `QuizResponse`.
- Validate:
  - `questions` is not empty
  - every question has exactly 4 options
  - `answer` exists in options

### B. Store quiz state
Keep these states in ViewModel:
- `quizQuestions: List<QuizQuestion>`
- `currentIndex: Int`
- `selectedAnswers: Map<Int, String>`
- `score: Int`
- `quizReady: Boolean`
- `quizStarted: Boolean`

### C. Error-safe parsing
- If parsing fails: show `Could not parse quiz data. Please regenerate quiz.`
- If malformed data: show `Quiz format is invalid.`

## 4) Chat -> Start Quiz Navigation

### Required UX
- AI bubble confirms quiz is ready.
- Show `Start Quiz` button in chat bubble.
- On tap `Start Quiz`:
  - call `onStartQuiz(quizData)`
  - navigate to QuizScreen

### Minimal integration points
- `ChatBubble` receives callback: `onStartQuiz: (QuizResponse) -> Unit`
- `ChatScreen` handles navigation to `QuizScreen`
- Pass quiz payload through shared ViewModel or navigation-safe state holder

## 5) QuizScreen (Professional UX)

### A. Render one question per page
- Use Pager (HorizontalPager / ViewPager2 style)
- Disable manual swipe if you want strict answer-first flow
- Show progress indicator: `Question 2 / 10`

### B. Interactions
- User selects one option per question
- `Next` button enabled only after selection
- `Previous` button optional

### C. Scoring
At submission:
- compare `selectedAnswers[question.id]` with `question.answer`
- compute total correct
- compute percentage

### D. Result screen/card
Show:
- total score (e.g., `8/10`)
- percentage
- performance message (Excellent / Good / Needs Practice)
- optional review mode with explanations

## 6) Suggested FE Behavior for Current Backend

If backend currently returns array directly (not wrapped by `questions`), FE should support both:

1. Wrapped format:
```json
{ "questions": [ ... ] }
```

2. Direct array:
```json
[ ... ]
```

Normalization strategy:
- If payload has `questions`, use it.
- Else if payload is array, map to `questions`.
- Else show parse error.

## 7) Prompt for FE AI (Copy-Paste)

Implement a structured quiz flow in Android Compose:
- Parse backend quiz JSON into typed models (`QuizResponse`, `QuizQuestion`)
- Support both response formats: `{ questions: [...] }` and direct `[...]`
- In chat bubble, show `Start Quiz` when quiz data is ready
- On `Start Quiz`, navigate to `QuizScreen`
- In `QuizScreen`, use pager-style one-question-per-page UX
- Track selected answers, compute score, and show final result screen
- Handle malformed JSON safely and show user-friendly error messages

## 8) Definition of Done

- User requests quiz in chat
- AI returns structured quiz data
- FE parses successfully
- `Start Quiz` button appears and works
- User completes quiz on dedicated screen
- Final score/result is displayed
- Errors are handled without app crash
