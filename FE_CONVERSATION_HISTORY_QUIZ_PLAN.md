# FE Guide: Conversation History, Quiz, and Study Plan

Canonical index: [FE_API_INDEX.md](FE_API_INDEX.md)

This guide explains how FE should load, render, and delete account-scoped conversation data.

## 1) Ownership and Scope

- Conversation metadata is stored in `conversations`.
- Message rows are stored in `chat_messages`.
- Every read/write action is scoped by JWT user.

Important behavior:

- A user can only read or delete their own conversations.
- Cross-account conversation access is not allowed.

## 2) Primary APIs for Inbox Experience

All endpoints below require `Authorization: Bearer <access_token>`.

### Load conversation list

- `GET /conversations`

Use for sidebar/drawer/inbox list.

### Load one thread

- `GET /conversations/:conversationId/messages`

Use when user opens a thread.

### Delete one thread

- `DELETE /conversations/:conversationId`

Success response:

```json
{
  "message": "Conversation deleted successfully."
}
```

404 means the thread does not exist or does not belong to the current account.

## 3) Message Types and Rendering

Conversation messages can be:

1. QA

- `messageType: "QA"`
- fields: `question`, `answer`

2. Artifact

- `messageType: "ARTIFACT"`
- `artifactType: "QUIZ" | "STUDY_PLAN"`
- `artifactJson` holds persisted content

Recommended rendering:

- QA: normal chat bubble pair
- Artifact + QUIZ: quiz card
- Artifact + STUDY_PLAN: study plan card

## 4) Related Write Flows

These APIs create data that appears in conversation history:

- `POST /documents/:id/chat`
- `POST /quizzes/generate/:documentId`
- `POST /documents/:id/study-plan`
- `POST /documents/:id/history/artifact`

Notes:

- Quiz and study plan generation persist artifact history rows.
- FE should refresh the opened thread after successful generation/save.

## 5) Document-Specific History Endpoint

- `GET /documents/:id/history`

Use this endpoint for document detail screens. For inbox-first screens, prefer conversation endpoints.

## 6) FE Checklist

- [ ] Load inbox with `GET /conversations` after login.
- [ ] Open thread with `GET /conversations/:conversationId/messages`.
- [ ] Render by `messageType` and `artifactType`.
- [ ] On delete confirm, call `DELETE /conversations/:conversationId`.
- [ ] After delete, remove item from UI list and refresh from backend.
- [ ] If delete returns 404, treat item as already removed and refresh list.
