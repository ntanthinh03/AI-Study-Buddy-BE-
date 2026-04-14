# FE Team Recommendations to Align with Backend

This note summarizes the most important frontend changes to stay aligned with the current backend contract.

## 1) Conversation Loading

Use the new conversation inbox flow as the main source of truth:

- `GET /conversations` after login to load the current account's conversation list.
- `GET /conversations/:conversationId/messages` when the user opens a specific conversation.

Recommended behavior:
- Treat the conversation inbox as account-scoped.
- Do not mix conversations between different accounts.
- Use `GET /documents/:id/history` only as a document-specific fallback or detail view.

## 2) Message Rendering Rules

Backend history can contain two message types:

- `QA`
- `ARTIFACT`

Render them like this:
- `QA` -> normal chat bubble with question and answer.
- `ARTIFACT` + `QUIZ` -> quiz card from `artifactJson`.
- `ARTIFACT` + `STUDY_PLAN` -> study plan card from `artifactJson`.

## 3) Study Plan Flow

Use the progress module for timeline and lesson tracking.

Core endpoints:
- `GET /progress/timeline`
- `POST /progress/init`
- `POST /progress/complete`
- `POST /progress/lessons`
- `GET /progress/lessons`
- `GET /progress/lessons/:lessonId`
- `POST /progress/lessons/:lessonId/quiz`

Recommended behavior:
- Use `GET /progress/timeline` for roadmap UI.
- Use lesson endpoints only for saved lesson history and quiz practice.
- Keep lesson history inside the progress guide instead of creating separate flows.

## 4) Password Flow

Use the current auth endpoints:

- `POST /auth/forgot-password`
- `POST /auth/change-password`

Recommended behavior:
- Validate password length on FE before calling backend.
- Attach Bearer token for `change-password`.
- Consider forcing re-login after password change to avoid stale session confusion.

## 5) Source of Truth

Frontend may keep local cache for faster rendering, but backend should be the source of truth for:

- conversations
- messages
- quizzes
- study plans
- progress

Recommended rule:
- Local cache = fallback / optimistic UI
- Backend = final persisted state

## 6) What to Prefer in New FE Work

Prefer these flows first:
1. `GET /conversations`
2. `GET /conversations/:conversationId/messages`
3. `GET /progress/timeline`
4. `POST /progress/init`
5. `POST /progress/complete`
6. `POST /auth/forgot-password`
7. `POST /auth/change-password`

## 7) Avoid

- Avoid using `documentId` as the main inbox key when the conversationId API already exists.
- Avoid showing the same endpoint in multiple docs.
- Avoid keeping separate lesson guides when lesson APIs already live in the progress guide.
- Avoid treating local cache as the only source of truth.

## 8) Short Version for FE Team

- Load inbox with `GET /conversations`.
- Load thread messages with `GET /conversations/:conversationId/messages`.
- Use `GET /documents/:id/history` only for document detail fallback.
- Use `GET /progress/timeline` for roadmap UI.
- Use lesson APIs under progress for saved lesson history and quiz JSON.
- Use auth password APIs exactly as documented.
