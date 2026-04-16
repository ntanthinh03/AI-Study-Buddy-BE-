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

### A) `POST /progress/lessons`

Create a lesson history entry.

### B) `GET /progress/lessons`

List lesson history rows for current user.

### C) `GET /progress/lessons/:lessonId`

Get one lesson detail row.

### D) `POST /progress/lessons/:lessonId/quiz`

Save or overwrite quiz JSON for a lesson.

Critical payload rule:

- `quiz` must be a non-empty array.
- Sending `quiz` as an object causes 400 validation error.
- `documentId` for progress init/complete must be a valid UUID.

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

## 6) Error Handling

- 401: token missing/expired/invalid
- 400: invalid body (for example wrong quiz payload shape)
- 404: document or lesson not found

## 7) FE Completion Checklist

- [ ] Attach JWT to all `/progress/*` requests.
- [ ] Map timeline status values without local remapping.
- [ ] Always send lesson `quiz` as array.
- [ ] Refetch timeline after completion updates.
