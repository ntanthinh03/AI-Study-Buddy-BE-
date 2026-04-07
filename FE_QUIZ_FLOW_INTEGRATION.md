# FE Integration Note - Quiz Flow (AI Study Buddy)

## Goal
When the user requests quiz generation, the backend returns quiz questions first. The frontend should then move to a separate quiz screen when the user taps **Start Quiz**.

## Backend Contract

### Generate Quiz
- Method: `POST`
- Endpoint: `/quizzes/generate/:documentId`
- Auth: Required
- Header:
  - `Authorization: Bearer <access_token>`
- Response: array of quiz questions

### Question Shape
```json
{
  "question": "What is ...?",
  "options": {
    "A": "...",
    "B": "...",
    "C": "...",
    "D": "..."
  },
  "correctAnswer": "A",
  "explanation": "..."
}
```

## Recommended FE Flow

### 1) User taps "Create a quiz"
- FE calls `POST /quizzes/generate/:documentId`
- Show loading state while waiting for the response

### 2) Backend returns quiz data
- FE does **not** immediately show the full quiz screen
- FE stores the returned quiz array in state / ViewModel / local session data
- FE can show a short success message like:
  - `Quiz is ready. Tap Start Quiz to begin.`

### 3) User taps "Start Quiz"
- FE navigates to a dedicated quiz screen
- Pass the quiz data to that screen
- Render questions one by one or as a list, depending on UI design

## UI/Navigation Requirement

- The chat screen should only be used to request quiz generation and confirm that quiz data is ready.
- The actual answering flow must happen in a separate quiz screen.
- The `Start Quiz` button should navigate to that screen.

## State Management Recommendation

Store the generated quiz in memory or ViewModel state:
- `quizQuestions`
- `currentQuestionIndex`
- `selectedAnswer`
- `score`
- `quizStarted`

If the app is closed or the screen is recreated, FE may re-fetch the quiz from the backend if needed.

## Error Handling

### 401 Unauthorized
- Token missing, expired, or invalid
- Clear token and ask user to log in again

### 404 / Invalid document
- Show: `Document not found`

### 500 / AI failure
- Show: `Could not generate quiz at the moment. Please try again.`

## Suggested FE Prompt

Implement quiz generation flow for AI Study Buddy.

Requirements:
- Call `POST /quizzes/generate/:documentId` with `Authorization: Bearer <access_token>`
- When the backend returns quiz questions, do not start the quiz immediately
- Store quiz questions in state/ViewModel
- Show a `Start Quiz` button
- When the user taps `Start Quiz`, navigate to a separate quiz screen and pass the quiz data there
- Handle `401 Unauthorized` by clearing token and prompting login again
- Use a loading indicator while quiz is being generated
- Show clear messages for API errors, invalid document, and AI generation failure

## Expected UX

1. User taps `Create a quiz`
2. App requests quiz from backend
3. App shows `Quiz ready`
4. User taps `Start Quiz`
5. App navigates to quiz screen
6. User answers the questions on the quiz screen
