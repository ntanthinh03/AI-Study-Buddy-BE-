# FE API Index - Canonical Endpoint Guide

This file is the single source of truth for endpoint naming used by FE.

## Naming Rules

- Use `/auth/*` for authentication and password flows.
- Use `/documents/*` for document upload, chat, and conversation history by document.
- Use `/conversations/*` for account-scoped inbox and message loading.
- Use `/quizzes/*` for quiz generation and quiz list.
- Use `/progress/*` for progress timeline and lesson history.
- Use `GET` for reading data, `POST` for creating/saving data, `DELETE` for removing data.

## Canonical Endpoints

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/change-password`

Response notes:
- `POST /auth/login` returns `{ access_token, user }` where `user` includes `id`, `email`, `fullName`, and `phoneNumber`.
- `POST /auth/forgot-password` returns `{ message: "Đặt lại mật khẩu thành công" }`.
- `POST /auth/change-password` returns `{ message: "Đổi mật khẩu thành công" }`.

### Documents and chat history
- `POST /documents/upload`
- `GET /documents`
- `DELETE /documents/:id`
- `POST /documents/:id/chat`
- `GET /documents/:id/history`
- `POST /documents/:id/study-plan`
- `POST /documents/:id/history/artifact`

Response notes:
- `POST /documents/:id/chat` returns `{ answer }`.
- `POST /documents/:id/study-plan` returns `{ studyPlan }`.
- `GET /documents/:id/history` returns raw chat message rows ordered oldest to newest.
- `POST /documents/:id/history/artifact` returns the saved artifact message row.

### Conversations inbox
- `GET /conversations`
- `GET /conversations/:conversationId/messages`

Response notes:
- `GET /conversations` returns conversation rows with the linked `document` relation.
- `GET /conversations/:conversationId/messages` returns the saved message rows for that conversation.

### Quizzes
- `POST /quizzes/generate/:documentId`
- `GET /quizzes`

Response notes:
- `POST /quizzes/generate/:documentId` returns the generated quiz question array.
- `GET /quizzes` returns saved quiz rows with the linked `document` relation.

### Progress
- `GET /progress/me`
- `GET /progress/timeline`
- `POST /progress/init`
- `POST /progress/complete`
- `POST /progress/lessons`
- `GET /progress/lessons`
- `GET /progress/lessons/:lessonId`
- `POST /progress/lessons/:lessonId/quiz`

Response notes:
- `GET /progress/timeline` returns `{ documentId, fileName, status, score }` items.
- `POST /progress/complete` returns `{ message }` and may include `nextModule`.
- `POST /progress/lessons/:lessonId/quiz` returns `{ message, lessonId, quizCount }`.

## FE Loading Strategy

1. After login, load `GET /conversations` once for the inbox.
2. When user opens a conversation, load `GET /conversations/:conversationId/messages`.
3. When user opens a document screen, load `GET /documents/:id/history` if needed.
4. Use `GET /progress/timeline` for roadmap UI.
5. Use lesson APIs only for saved lesson history and lesson quiz practice.

## Related Focused Guides

- Password and recovery: [FE_AUTH_PASSWORD_APIS.md](FE_AUTH_PASSWORD_APIS.md)
- Conversation history and artifacts: [FE_CONVERSATION_HISTORY_QUIZ_PLAN.md](FE_CONVERSATION_HISTORY_QUIZ_PLAN.md)
- Progress timeline: [FE_PROGRESS_JSON_API_GUIDE.md](FE_PROGRESS_JSON_API_GUIDE.md)

Lesson history and quiz are included in the progress guide above, so there are only three core guides to read.

