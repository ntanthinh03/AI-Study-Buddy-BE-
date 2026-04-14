# FE Guide - Conversation History with Quiz + Study Plan

Canonical endpoint naming and global FE order: [FE_API_INDEX.md](FE_API_INDEX.md)

This guide explains how account-scoped conversations are stored and how quiz/study-plan artifacts are attached to each conversation.

## 1) Scope and Ownership

- Conversation metadata is stored in table `conversations`.
- Message history is stored in table `chat_messages`.
- Every message row is tied to:
  - `user_id` (account owner)
  - `document_id` (document tab)
  - `conversation_id` (conversation thread)
- Users only read their own history.

## 1.1) One-time conversation loading

FE should first load the conversation list once for the signed-in account:

- `GET /conversations`

This endpoint returns only conversations owned by the current JWT user, each with the linked `document` relation.
Use it to render the drawer/inbox once, then load messages for a selected conversation.

## 2) Message Types in History

`GET /documents/:id/history` returns the saved message rows for one document and includes these message types:

1. QA message
- `messageType: "QA"`
- fields: `question`, `answer`

2. Artifact message
- `messageType: "ARTIFACT"`
- `artifactType: "QUIZ" | "STUDY_PLAN"`
- `artifactJson`: saved JSON payload for that quiz/plan
- optional `question` used as note

## 3) APIs FE should use

All APIs below require JWT Bearer token.

### A) Load all conversations for current account
- `GET /conversations`
- returns only that account's conversations

Example response:
```json
[
  {
    "id": "conv-uuid",
    "userId": "user-uuid",
    "documentId": "doc-001",
    "title": "sql-basics.pdf",
    "kind": "PLAN",
    "lastMessagePreview": "Generated study plan",
    "lastArtifactType": "STUDY_PLAN",
    "lastMessageAt": "2026-04-14T09:20:00.000Z",
    "document": {
      "id": "doc-001",
      "fileName": "sql-basics.pdf"
    }
  }
]
```

### B) Load messages for a conversation
- `GET /conversations/:conversationId/messages`
- returns only messages owned by the current account for that conversation, ordered oldest to newest

Example response:
```json
[
  {
    "id": "msg-1",
    "messageType": "QA",
    "question": "Explain joins in SQL",
    "answer": "...",
    "artifactType": null,
    "artifactJson": null,
    "createdAt": "2026-04-14T09:00:00.000Z"
  },
  {
    "id": "msg-2",
    "messageType": "ARTIFACT",
    "question": "Generated study plan",
    "answer": null,
    "artifactType": "STUDY_PLAN",
    "artifactJson": { "planId": "..." },
    "createdAt": "2026-04-14T09:20:00.000Z"
  }
]
```

### A) Ask normal chat and persist QA
- `POST /documents/:id/chat`
- body:
```json
{
  "question": "Explain joins in SQL"
}
```

### B) Generate quiz and auto-attach to conversation
- `POST /quizzes/generate/:documentId`
- backend auto-saves:
  - quiz row in `quizzes`
  - artifact message (`artifactType = QUIZ`) in `chat_messages`

### C) Generate study plan and auto-attach to conversation
- `POST /documents/:id/study-plan`
- response:
```json
{
  "studyPlan": {
    "planId": "...",
    "title": "...",
    "overview": "...",
    "estimatedTotalMinutes": 120,
    "modules": [ ... ]
  }
}
```
- backend auto-saves artifact message (`artifactType = STUDY_PLAN`) in `chat_messages`

### D) Save custom artifact from FE into conversation
- `POST /documents/:id/history/artifact`
- body:
```json
{
  "artifactType": "QUIZ",
  "artifact": [ ... ],
  "note": "Generated quiz v2"
}
```
- returns the saved artifact message row

### E) Reload full conversation history
- `GET /documents/:id/history`

Use this only if FE is already on a document screen. For inbox/list screen, prefer `GET /conversations` first.

## 4) FE rendering rule

When mapping history items:

- If `messageType == "QA"`: render normal chat bubble with `question` and `answer`.
- If `messageType == "ARTIFACT"` and `artifactType == "QUIZ"`: render quiz card from `artifactJson`.
- If `messageType == "ARTIFACT"` and `artifactType == "STUDY_PLAN"`: render study-plan card from `artifactJson`.

This ensures old conversations reopen with the exact quiz/plan created at that time.

## 5) FE checklist

- [ ] Use account token for all endpoints above
- [ ] Load `GET /conversations` once after login for inbox/drawer
- [ ] After creating quiz/plan, refresh `GET /documents/:id/history`
- [ ] Render by `messageType` + `artifactType`
- [ ] Do not mix histories across document tabs
- [ ] Handle empty `question/answer` for artifact rows
