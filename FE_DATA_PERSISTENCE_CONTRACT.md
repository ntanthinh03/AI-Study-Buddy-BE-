# FE Guide: Data Persistence and Cascade Delete Contract

Canonical index: [FE_API_INDEX.md](FE_API_INDEX.md)

This document guarantees when and how FE data is persisted to the backend database, and what happens when a conversation is deleted.

## 1) Core Principle: Conversation is Root Container

Every piece of data created within a conversation is automatically deleted **only** when the conversation itself is deleted.

- Chat messages, quiz records, and lesson records are **NOT** independently deletable from the backend.
- FE delete only happens at the conversation level: `DELETE /conversations/:conversationId`.
- Deleting a conversation removes all linked data from the database.

## 2) What Data Gets Saved and When

### Chat Messages (QA Type)

**Persistence trigger:**
- `POST /chat/ask` — Saves chat message (general chat)
- `POST /chat/ask-image` — Saves chat message with image (general chat)
- `POST /documents/:id/chat` — Saves document-scoped chat message

**Data saved:**
- Message row with fields: `question`, `answer`, `messageType: 'QA'`, `createdAt`, `conversationId`
- Message is immediately queryable via `GET /conversations/:conversationId/messages`

**Example response:**
```json
{
  "conversationId": "1be47916-a7f8-4172-98cd-1684a5f2d13a",
  "messageId": "abc12345-6789-....",
  "question": "What is a database?",
  "answer": "A database is a structured collection...",
  "createdAt": "2026-05-06T10:30:00Z"
}
```

### Quiz Records (Artifact Type)

**Persistence trigger:**
- `POST /quizzes/generate/:documentId` — Generates quiz and saves artifact record + quiz entity row

**Optional FE-sent display name:**
- `quizName` can be sent by FE when the AI already created a label.
- If FE does not send `quizName`, backend falls back to `Quiz - <document name>`.

**Data saved:**
1. **Chat message row** (artifact type)
   - Fields: `messageType: 'ARTIFACT'`, `artifactType: 'QUIZ'`, `artifactJson: [...questions]`, `conversationId`
   - Queryable via `GET /conversations/:conversationId/messages`

2. **Quiz entity row** (separate table)
  - Fields: `quizName`, `questions`, `conversationId`, `userId`, `documentId`, `createdAt`
   - Queryable via `GET /quizzes`

**Example response:**
```json
{
  "quizId": "15bfb07f-56ab-49f0-8f41-39ca7f3f6c2b",
  "quizName": "Quiz - Database Fundamentals",
  "conversationId": "1be47916-a7f8-4172-98cd-1684a5f2d13a",
  "questions": [
    {
      "question": "What does SQL stand for?",
      "options": {
        "A": "Structured Query Language",
        "B": "Simple Query Logic"
      },
      "correctAnswer": "A"
    }
  ]
}
```

**Important:** FE must capture and store `conversationId` from the response to create linked lesson records later.

### Study Plan and Lessons

**Persistence trigger:**
- `POST /documents/:id/study-plan` — Generates study plan and saves artifact record (message)
- `POST /progress/lessons` — Creates lesson record (linked to conversation)

**Data saved:**

1. **Study plan artifact message row** (when plan generated)
   - Fields: `messageType: 'ARTIFACT'`, `artifactType: 'STUDY_PLAN'`, `artifactJson: {...plan}`, `conversationId`
   - Queryable via `GET /conversations/:conversationId/messages`

2. **Lesson entity rows** (when lesson saved)
  - Required fields: `title`, `contentText`, `conversationId`, `status` (default `IN_PROGRESS`)
  - Optional fields: `courseName`, `documentId`, `quiz`, `completedAt`
   - Fields: `userId`, `conversationId`, `createdAt`, `updatedAt`
   - Queryable via `GET /progress/lessons` or `GET /progress/lessons?conversationId=...`

**Optional FE-sent display name:**
- `courseName` can be sent by FE when the AI already created a course label.
- If FE does not send `courseName`, backend falls back to the conversation title.

**Example lesson save:**
```json
POST /progress/lessons

{
  "conversationId": "1be47916-a7f8-4172-98cd-1684a5f2d13a",
  "courseName": "Database Fundamentals",
  "documentId": "8f7f4d7a-9f9e-4c97-b1e2-c6f9f5e5b0e1",
  "title": "Lesson 1: Database Fundamentals",
  "contentText": "Learn about relational databases...",
  "status": "IN_PROGRESS"
}
```

**Response:**
```json
{
  "id": "lesson-uuid-1234",
  "userId": "user-uuid",
  "courseName": "Database Fundamentals",
  "conversationId": "1be47916-a7f8-4172-98cd-1684a5f2d13a",
  "title": "Lesson 1: Database Fundamentals",
  "contentText": "Learn about relational databases...",
  "status": "IN_PROGRESS",
  "completedAt": null,
  "createdAt": "2026-05-06T10:30:00Z",
  "updatedAt": "2026-05-06T10:30:00Z"
}
```

### Lesson Status Updates

**Persistence trigger:**
- `POST /progress/lessons/:lessonId/status` — Update lesson status

**Data updated:**
- Fields: `status` (one of `IN_PROGRESS`, `COMPLETED`), `completedAt` (set to current timestamp if status is `COMPLETED`)

**Example:**
```json
POST /progress/lessons/{lessonId}/status

{
  "status": "COMPLETED"
}
```

**Response:**
```json
{
  "message": "Lesson status was updated successfully.",
  "lessonId": "lesson-uuid-1234",
  "status": "COMPLETED",
  "completedAt": "2026-05-06T10:35:00Z"
}
```

### Quiz Assignment to Lessons

**Persistence trigger:**
- `POST /progress/lessons/:lessonId/quiz` — Save quiz questions to a lesson

**Data saved:**
- Field: `quizJson` (array of quiz questions)
- Same lesson record updated; `lastStudiedAt` refreshed

**Example:**
```json
POST /progress/lessons/{lessonId}/quiz

{
  "quiz": [
    {
      "question": "What is 1NF?",
      "options": { "A": "First Normal Form", "B": "..." },
      "correctAnswer": "A"
    }
  ]
}
```

## 3) Cascade Delete: What Happens When Conversation is Deleted

When `DELETE /conversations/:conversationId` is called:

1. **All chat messages** linked to this conversation are deleted from DB
   - QA-type messages (normal chat)
   - ARTIFACT-type messages (quiz/study plan previews)

2. **All quiz entity records** linked to this conversation are deleted from DB
   - Automatically cascaded by foreign key constraint `onDelete: CASCADE`

3. **All lesson records** linked to this conversation are deleted from DB
   - Automatically cascaded by foreign key constraint `onDelete: CASCADE`
   - Including associated quiz JSON stored in `quizJson` field

4. **The conversation itself** is deleted

**Important:** There is **no partial delete**. Deleting a conversation deletes everything inside it as a transactional unit.

## 4) FE Workflow to Achieve Persistence Guarantee

### Step 1: General Chat Flow
```
FE sends: POST /chat/ask
         { message: "...", conversationId?: "..." (optional) }
↓
BE response: { conversationId, messageId, question, answer, createdAt }
             ✓ Message now in DB linked to conversationId
FE action: Store conversationId for reuse in next messages
```

### Step 2: Generate Quiz Flow
```
FE sends: POST /quizzes/generate/:documentId
↓
BE response: { quizId, conversationId, questions }
             ✓ Quiz artifact message now in DB
             ✓ Quiz entity row now in DB
FE action: Store conversationId and questions
```

### Step 3: Create Study Plan Lesson Flow
```
FE sends: POST /documents/:id/study-plan
↓
BE response: { studyPlan: {...} }
             ✓ Study plan artifact message now in DB with conversationId
             
FE then sends: POST /progress/lessons
              {
                conversationId: "..." (from quiz or chat response),
                title: "Study Plan Part 1",
                contentText: "...",
                status: "IN_PROGRESS"
              }
↓
BE response: { id: lessonId, conversationId, status, ... }
             ✓ Lesson row now in DB
```

### Step 4: Update Lesson Status
```
FE sends: POST /progress/lessons/:lessonId/status
         { status: "COMPLETED" }
↓
BE response: { message: "...", lessonId, status, completedAt }
             ✓ Lesson status now updated in DB
```

### Step 5: Delete Conversation
```
FE sends: DELETE /conversations/:conversationId
↓
BE response: { message: "Conversation deleted successfully." }
             ✓ ALL data (messages, quizzes, lessons) deleted from DB
FE action: Remove conversation from UI list
           Refresh conversation list
```

## 5) Data Model Diagram

```
Conversation (root)
├── ChatMessage (QA-type)
│   ├── question
│   ├── answer
│   └── createdAt
├── ChatMessage (ARTIFACT-type, QUIZ)
│   ├── artifactJson (questions array)
│   └── conversationId → CASCADE DELETE
├── ChatMessage (ARTIFACT-type, STUDY_PLAN)
│   ├── artifactJson (plan structure)
│   └── conversationId → CASCADE DELETE
├── Quiz (entity row)
│   ├── questions
│   ├── conversationId → CASCADE DELETE
│   └── userId
└── LearningLesson
    ├── title
    ├── contentText
    ├── status (IN_PROGRESS | COMPLETED)
    ├── quizJson
    ├── conversationId → CASCADE DELETE
    └── userId
```

## 6) Error Scenarios and Handling

### "Conversation not found" when creating lesson
- HTTP 404
- Reason: FE sent invalid or non-existent `conversationId`
- FE action: Ensure `conversationId` comes from a previous chat/quiz/message response

### "Lesson not found" when updating status
- HTTP 404
- Reason: FE sent invalid `lessonId` or lesson belongs to different user
- FE action: Validate `lessonId` is from current user's lessons

### Delete conversation returns 404
- HTTP 404
- Reason: Conversation already deleted or invalid ID
- FE action: Treat as success (idempotent); remove from UI list

### Message not immediately visible after POST
- Cause: Race condition in UI refresh
- FE action: Call `GET /conversations/:conversationId/messages` to verify persistence

## 7) FE Checklist for Persistence Contract Compliance

- [ ] Every `POST /chat/ask` or `POST /chat/ask-image` saves message to DB immediately
- [ ] Capture and store `conversationId` from first message in thread
- [ ] Reuse `conversationId` for all subsequent messages in same thread
- [ ] When generating quiz (`POST /quizzes/generate/:documentId`), capture returned `conversationId`
- [ ] When creating lesson (`POST /progress/lessons`), always include valid `conversationId`
- [ ] Lesson status updates go through dedicated `POST /progress/lessons/:lessonId/status` endpoint
- [ ] Deleting conversation with `DELETE /conversations/:conversationId` removes all linked data
- [ ] No orphaned quiz or lesson records exist after conversation delete
- [ ] No manual deletion of quiz or lesson rows (only via conversation delete)
