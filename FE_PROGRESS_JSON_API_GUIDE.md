# FE Guide - Progress JSON API (Quiz-like Integration)

Canonical endpoint naming and global FE order: [FE_API_INDEX.md](FE_API_INDEX.md)

This guide helps FE integrate progress flow with clear JSON contracts, similar to quiz integration docs.

## 1) Overview

Progress module provides 4 main APIs:

1. GET /progress/me
2. GET /progress/timeline
3. POST /progress/init
4. POST /progress/complete

All progress APIs require JWT Bearer token.

Header:
```text
Authorization: Bearer <access_token>
```

## 2) Status Model for FE

Use this status enum in FE:

- LOCKED
- IN_PROGRESS
- COMPLETED

Status is returned directly by `GET /progress/timeline`.

## 3) API Contracts

## A) GET /progress/me

### Purpose
Get raw progress rows for current user (entity-level data).

### Auth
Required.

### Response example
```json
[
  {
    "id": "a2f4d5f6-1111-2222-3333-abcdef123456",
    "userId": "u-123",
    "isCompleted": false,
    "isLocked": false,
    "highestScore": null,
    "document": {
      "id": "doc-001",
      "fileName": "sql-basics.pdf"
    }
  }
]
```

### FE use-case
- Internal debug screen
- Full detail sync with local cache

## B) GET /progress/timeline

### Purpose
Get FE-ready simplified timeline.

### Auth
Required.

### Response example
```json
[
  {
    "documentId": "doc-001",
    "fileName": "sql-basics.pdf",
    "status": "IN_PROGRESS",
    "score": 0
  },
  {
    "documentId": "doc-002",
    "fileName": "joins.pdf",
    "status": "LOCKED",
    "score": 0
  }
]
```

### FE use-case
- Main roadmap/timeline UI
- Module card status badge

## C) POST /progress/init

### Purpose
Initialize progress row when a document/module appears for user.

### Auth
Required.

### Request body
```json
{
  "documentId": "doc-001"
}
```

The backend returns the saved progress row for that document.

### Response example
```json
{
  "id": "a2f4d5f6-1111-2222-3333-abcdef123456",
  "userId": "u-123",
  "isCompleted": false,
  "isLocked": false,
  "highestScore": null,
  "document": {
    "id": "doc-001"
  }
}
```

Notes:
- First module for a user is auto-unlocked.
- Next modules are created as locked.

## D) POST /progress/complete

### Purpose
Mark current module completed and unlock next module.

### Auth
Required.

### Request body
```json
{
  "documentId": "doc-001",
  "score": 85
}
```

### Response example
```json
{
  "message": "Current module completed, next module unlocked!",
  "nextModule": "progress-row-id"
}
```

Alternative success response:
```json
{
  "message": "Module updated successfully."
}
```

The backend only includes `nextModule` when a subsequent module exists.

## E) Lesson history and lesson quiz

These endpoints are for saving study lessons and quiz JSON under the current account.

### POST /progress/lessons

Create and save a lesson for current user.

Request body:
```json
{
  "documentId": "doc-001",
  "title": "Lesson 1 - SQL Basics",
  "contentText": "SQL is used to query relational databases..."
}
```

Response: saved lesson row, including `id`, `userId`, `documentId`, `title`, `contentText`, `quizJson`, `lastStudiedAt`, `createdAt`, and `updatedAt`.

### GET /progress/lessons

Get lesson history list for current user only.

Response: array of saved lesson rows ordered by `updatedAt` descending.

### GET /progress/lessons/:lessonId

Get lesson detail, including saved quiz JSON, for the current user.

Response: one saved lesson row.

### POST /progress/lessons/:lessonId/quiz

Save or overwrite quiz JSON for one lesson.

Request body:
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

Response example:
```json
{
  "message": "Lesson quiz saved successfully",
  "lessonId": "lesson-uuid",
  "quizCount": 1
}
```

## 4) FE Integration Flow (Recommended)

1. User uploads/opens a new document.
2. FE calls `POST /progress/init` with documentId.
3. FE calls `GET /progress/timeline` to render roadmap.
4. User finishes quiz.
5. FE calls `POST /progress/complete` with `{ documentId, score }`.
6. FE refreshes `GET /progress/timeline`.

## 5) FE JSON Models (Example)

```kotlin
enum class ProgressStatus { LOCKED, IN_PROGRESS, COMPLETED }

data class ProgressTimelineItem(
    val documentId: String,
    val fileName: String,
    val status: ProgressStatus,
    val score: Double
)

data class InitProgressRequest(
    val documentId: String
)

data class CompleteProgressRequest(
    val documentId: String,
    val score: Double
)
```

## 6) Error Handling Checklist

- 401 Unauthorized:
  - Token missing/expired/invalid
  - FE should clear token and redirect to login
- 400 Bad Request:
  - Invalid request body (missing documentId/score)
- 404 Not Found:
  - Document may not exist

## 7) FE API Check Checklist

- [ ] JWT token attached to all `/progress/*` requests
- [ ] `POST /progress/init` called after new module/document is available
- [ ] `POST /progress/complete` called after quiz submission
- [ ] `GET /progress/timeline` re-fetched after complete
- [ ] UI status mapped exactly: LOCKED, IN_PROGRESS, COMPLETED
- [ ] Score rendered from `timeline.score`

## 8) Definition of Done

- FE can initialize progress for a document
- FE can show roadmap timeline from backend JSON
- FE can complete module with score
- FE can show next module unlocked after refresh
- FE handles auth failure safely
- FE can save and reopen lesson history with quiz JSON
