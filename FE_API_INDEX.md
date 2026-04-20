# FE API Index (Developer Handover)

This document is the entry point for frontend and QA developers. It summarizes the active backend API surface that FE should consume.

## Core Rules

- Authentication endpoint group: `/auth/*`
- Document processing and document-scoped history: `/documents/*`
- Account-scoped inbox and thread management: `/conversations/*`
- General chat (non-document): `/chat/*`
- Quiz endpoints: `/quizzes/*`
- Progress and lesson tracking: `/progress/*`

All protected APIs require:

`Authorization: Bearer <access_token>`

## Canonical Endpoints

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/forgot-password/send-otp`
- `POST /auth/forgot-password/verify-otp`
- `POST /auth/forgot-password/reset-with-token`
- `POST /auth/forgot-password`
- `POST /auth/change-password`

Contract notes:

- Register requires `email`, `password`, `fullName`, and `phoneNumber`.
- Login response returns `{ access_token, user }`.
- OTP reset flow is the recommended forgot-password path for FE.
- Forgot password success response returns `{ message: "Password reset completed successfully." }`.
- Change password success response returns `{ message: "Password changed successfully." }`.

### Conversations (Account Inbox)

- `GET /conversations`
- `GET /conversations/:conversationId/messages`
- `DELETE /conversations/:conversationId`

Contract notes:

- Conversations are user-scoped by JWT.
- Delete returns `{ message: "Conversation deleted successfully." }`.
- Delete returns 404 when conversation does not exist or does not belong to the current user.

### General Chat

- `POST /chat/ask`
- `POST /chat/ask-image`
- `GET /chat/messages/:messageId/image`

Contract notes:

- `POST /chat/ask` and `POST /chat/ask-image` support `conversationId` to append to an existing thread.
- If `conversationId` is omitted, backend creates a new conversation automatically.

### Documents

- `POST /documents/upload`
- `GET /documents`
- `DELETE /documents/:id`
- `POST /documents/:id/chat`
- `GET /documents/:id/history`
- `POST /documents/:id/study-plan`
- `POST /documents/:id/history/artifact`

Contract notes:

- `POST /documents/:id/chat` returns `{ answer }`.
- `POST /documents/:id/study-plan` returns `{ studyPlan }`.
- `GET /documents/:id/history` returns message rows ordered by `createdAt` ascending.

### Quizzes

- `POST /quizzes/generate/:documentId`
- `GET /quizzes`

### Progress

- `GET /progress/me`
- `GET /progress/timeline`
- `POST /progress/init`
- `POST /progress/complete`
- `POST /progress/lessons`
- `GET /progress/lessons`
- `GET /progress/lessons/:lessonId`
- `POST /progress/lessons/:lessonId/quiz`

Contract notes:

- `documentId` in `POST /progress/init` and `POST /progress/complete` must be a UUID document id from backend (not placeholders like `doc-001`).

## Recommended FE Boot Sequence

1. Login and store `access_token`.
2. Load `GET /conversations` for drawer/inbox.
3. Load `GET /progress/timeline` for roadmap/home overview.
4. Lazy-load conversation messages via `GET /conversations/:conversationId/messages` when a thread is opened.

## Focused Documents

- Password flows: [FE_AUTH_PASSWORD_APIS.md](FE_AUTH_PASSWORD_APIS.md)
- Conversation, quiz, and study plan rendering: [FE_CONVERSATION_HISTORY_QUIZ_PLAN.md](FE_CONVERSATION_HISTORY_QUIZ_PLAN.md)
- Progress and lesson quiz payloads: [FE_PROGRESS_JSON_API_GUIDE.md](FE_PROGRESS_JSON_API_GUIDE.md)
- FE/BE alignment recommendations: [FE_BE_ALIGNMENT_RECOMMENDATIONS.md](FE_BE_ALIGNMENT_RECOMMENDATIONS.md)

