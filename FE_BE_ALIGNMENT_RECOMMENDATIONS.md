# FE-BE Alignment Recommendations

This document captures practical rules for keeping frontend behavior aligned with the current backend contract.

## 1) Conversation as the Primary Inbox Unit

Use conversation endpoints as the default chat source:

- `GET /conversations`
- `GET /conversations/:conversationId/messages`
- `DELETE /conversations/:conversationId`

Guidelines:

- Conversations are account-scoped by JWT.
- Never merge conversation data between accounts.
- If delete returns 404, treat the record as already removed and refresh list.

## 2) Message Rendering Contract

Message rows can contain:

- `messageType = QA`
- `messageType = ARTIFACT`

Rendering rules:

- QA: render question and answer bubbles.
- ARTIFACT + QUIZ: render quiz card using `artifactJson`.
- ARTIFACT + STUDY_PLAN: render study plan card using `artifactJson`.

## 3) Document vs Conversation History

- Use `GET /conversations/:conversationId/messages` for inbox thread view.
- Use `GET /documents/:id/history` only when FE is explicitly on a document detail screen.

This avoids mixing account inbox concerns with document detail concerns.

## 4) Progress Module Integration

Use these as canonical roadmap endpoints:

- `GET /progress/timeline`
- `POST /progress/init`
- `POST /progress/complete`

Lesson history and quiz persistence remain under:

- `POST /progress/lessons`
- `GET /progress/lessons`
- `GET /progress/lessons/:lessonId`
- `POST /progress/lessons/:lessonId/quiz`

## 5) Password Flow Reliability

- Use `POST /auth/forgot-password` for recovery.
- Use `POST /auth/change-password` for authenticated update.
- Validate new password length client-side before sending.

## 6) Source of Truth Policy

Use this rule consistently:

- FE local cache: optimistic UI and fast rendering.
- Backend API state: final persisted truth.

After create/update/delete mutations, revalidate from backend (at least list-level).

## 7) Common Mistakes to Avoid

- Using `documentId` as inbox primary key when `conversationId` exists.
- Assuming local cache delete succeeded without refetch/validation.
- Sending lesson quiz payload as object instead of array for `/progress/lessons/:lessonId/quiz`.
- Duplicating endpoint contracts in multiple FE documents without updating all copies.

## 8) Short Operational Checklist

1. Login and store JWT.
2. Load inbox via `GET /conversations`.
3. Load messages by `conversationId`.
4. On delete, call `DELETE /conversations/:conversationId`, then refresh list.
5. Use progress timeline as roadmap source.
6. Keep FE docs synced with `FE_API_INDEX.md` first.
