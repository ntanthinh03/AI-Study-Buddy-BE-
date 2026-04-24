# FE Guide: Progress and Lesson Quiz APIs

Canonical index: [FE_API_INDEX.md](FE_API_INDEX.md)

This document describes progress contracts used by roadmap UI and lesson-level quiz persistence.

## 1) Auth Requirement

All `/progress/*` endpoints require:

```text
Authorization: Bearer <access_token>
```

## 2) Timeline Status Model

Use these backend statuses directly in FE:

- `LOCKED`
- `IN_PROGRESS`
- `COMPLETED`

## 3) Core Progress Endpoints

### A) `GET /progress/me`

Raw entity-level progress rows for the current user.

Use case:

- Debug/admin-style detail view

### B) `GET /progress/timeline`

FE-ready roadmap data with simplified fields:

- `documentId`
- `fileName`
- `status`
- `score`

Use case:

- Main roadmap screen

### C) `POST /progress/init`

Initializes a progress row for a document.

Request body:

```json
{
  "documentId": "8f7f4d7a-9f9e-4c97-b1e2-c6f9f5e5b0e1"
}
```

### D) `POST /progress/complete`

Marks current module complete and may unlock the next module.

Request body:

```json
{
  "documentId": "8f7f4d7a-9f9e-4c97-b1e2-c6f9f5e5b0e1",
  "score": 85
}
```

Success response includes:

- `message`
- optional `nextModule`

## 4) Lesson History and Lesson Quiz

Lesson persistence rules:

- Every lesson row must be tied to a `conversationId`.
- Lesson statuses supported by backend: `IN_PROGRESS`, `COMPLETED`.
- Lesson rows are deleted from DB when the parent conversation is deleted.

### A) `POST /progress/lessons`

Create a lesson history entry.

Required body fields:

- `conversationId` (UUID)
- `title`
- `contentText`

Optional body fields:

- `documentId`
- `status` (`IN_PROGRESS` or `COMPLETED`, default is `IN_PROGRESS`)

Example:

```json
{
  "conversationId": "1be47916-a7f8-4172-98cd-1684a5f2d13a",
  "documentId": "8f7f4d7a-9f9e-4c97-b1e2-c6f9f5e5b0e1",
  "title": "Lesson 1: Normal Forms",
  "contentText": "Understand 1NF, 2NF, 3NF",
  "status": "IN_PROGRESS"
}
```

### B) `GET /progress/lessons`

List lesson history rows for current user.

Optional query:

- `conversationId` to fetch lessons in a specific thread.

### C) `GET /progress/lessons/:lessonId`

Get one lesson detail row.

### D) `POST /progress/lessons/:lessonId/quiz`

Save or overwrite quiz JSON for a lesson.

### E) `POST /progress/lessons/:lessonId/status`

Update lesson status.

Request body:

```json
{
  "status": "COMPLETED"
}
```

Critical payload rule:

- `quiz` must be a non-empty array.
- Sending `quiz` as an object causes 400 validation error.
- `documentId` for progress init/complete must be a valid UUID.
- `conversationId` in `POST /progress/lessons` must be a valid UUID and owned by current user.

Valid request example:

```json
{
  "quiz": [
    {
      "question": "What does SQL stand for?",
      "options": {
        "A": "Structured Query Language",
        "B": "Simple Query Logic",
        "C": "System Query Layer",
        "D": "Standard Question Language"
      },
      "correctAnswer": "A",
      "explanation": "SQL stands for Structured Query Language."
    }
  ]
}
```

## 5) Recommended FE Flow

1. On document/module availability, call `POST /progress/init`.
2. Load roadmap using `GET /progress/timeline`.
3. After quiz submission, call `POST /progress/complete`.
4. Refresh `GET /progress/timeline`.
5. Persist lesson quiz history with `POST /progress/lessons/:lessonId/quiz`.
6. Update lesson completion with `POST /progress/lessons/:lessonId/status`.

## 6) Error Handling

- 401: token missing/expired/invalid
- 400: invalid body (for example wrong quiz payload shape)
- 404: document or lesson not found
- 404: conversation not found (or not owned by current user) when saving lesson

## 7) FE Completion Checklist

- [ ] Attach JWT to all `/progress/*` requests.
- [ ] Map timeline status values without local remapping.
- [ ] Always send lesson `quiz` as array.
- [ ] Always send valid `conversationId` for lesson creation.
- [ ] Update lesson `status` using dedicated status endpoint.
- [ ] Refetch timeline after completion updates.
