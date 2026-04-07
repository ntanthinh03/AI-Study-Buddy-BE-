# AI Study Buddy Backend API (Frontend + RAG/LLM)

This document summarizes the current NestJS backend APIs for frontend development (Android Jetpack Compose or Web).

## 1. System Overview

- Backend framework: NestJS
- Authentication: JWT Bearer token
- Database: PostgreSQL (TypeORM)
- RAG stack: Ollama + PGVector (`@langchain/community/vectorstores/pgvector`)
- LLM stack:
  - Document summary/chat/quiz: Gemini (`gemini-1.5-flash`)
  - RAG answer generation: Phi-3 Medium via Ollama (`phi3:medium-128k`)

## 2. Base URL and Global Config

- Local base URL: `http://localhost:3001`
- CORS: enabled (`app.enableCors()`)
- Global validation pipe:
  - `whitelist: true`
  - `forbidNonWhitelisted: true`
  - `transform: true`

## 3. Environment Variables and Database Connections

The backend currently uses two database connection styles in parallel:

- Primary application data (TypeORM entities):
  - `DB_HOST`
  - `DB_PORT`
  - `DB_USERNAME`
  - `DB_PASSWORD`
  - `DB_DATABASE`

- RAG vector store (`PGVectorStore`):
  - `DATABASE_URL`

Current behavior in code:

- `AppModule` reads `DB_*` variables for the main TypeORM connection.
- `RagService` reads `DATABASE_URL` for vector operations (`english_knowledge` table).

Recommendation:

- Keep `DB_*` and `DATABASE_URL` pointing to the same PostgreSQL instance unless you intentionally separate transactional data and vector data.
- Ensure pgvector extension is enabled in the database used by `DATABASE_URL`.

## 4. Authentication for Frontend

### Common Header

For protected endpoints, include:

`Authorization: Bearer <access_token>`

### Register

- Method: `POST`
- Path: `/auth/register`
- Auth required: No
- Request body:

```json
{
  "email": "student@example.com",
  "password": "123456",
  "fullName": "Nguyen Van A"
}
```

- Validation rules:
  - `email`: valid email format
  - `password`: minimum 6 characters
  - `fullName`: required

- Response: created user object (no JWT token)

### Login

- Method: `POST`
- Path: `/auth/login`
- Auth required: No
- Request body:

```json
{
  "email": "student@example.com",
  "password": "123456"
}
```

- Response:

```json
{
  "access_token": "<jwt_token>",
  "user": {
    "id": "uuid",
    "email": "student@example.com",
    "fullName": "Nguyen Van A"
  }
}
```

## 5. Documents API (Core Learning Flow)

All endpoints in this section require JWT.

### Upload PDF Document

- Method: `POST`
- Path: `/documents/upload`
- Auth required: Yes
- Content-Type: `multipart/form-data`
- Form-data:
  - `file`: PDF file

- Sample response:

```json
{
  "id": "uuid",
  "fileName": "machine-learning.pdf",
  "fileSize": 1234567,
  "filePath": "...",
  "status": "PROCESSING",
  "createdAt": "2026-04-07T10:00:00.000Z"
}
```

### List User Documents

- Method: `GET`
- Path: `/documents`
- Auth required: Yes
- Response: `Document[]` (newest first)

### Delete Document

- Method: `DELETE`
- Path: `/documents/:id`
- Auth required: Yes
- Response:

```json
{
  "message": "Document and related data deleted successfully."
}
```

### Ask AI with Document Context (Gemini)

- Method: `POST`
- Path: `/documents/:id/chat`
- Auth required: Yes
- Request body:

```json
{
  "question": "Please summarize chapter 1"
}
```

- Response:

```json
{
  "answer": "..."
}
```

Notes:
- Chat history is automatically saved into `chat_messages`.
- If the document text is not ready yet, API returns `400 Bad Request`.

### Get Document Chat History

- Method: `GET`
- Path: `/documents/:id/history`
- Auth required: Yes
- Response: `ChatMessage[]` (oldest to newest)

## 6. Quiz API

All endpoints in this section require JWT.

### Generate Quiz from Document

- Method: `POST`
- Path: `/quizzes/generate/:documentId`
- Auth required: Yes
- Request body: none
- Response: array of generated quiz questions

Question format:

```json
{
  "question": "...",
  "options": {
    "A": "...",
    "B": "...",
    "C": "...",
    "D": "..."
  },
  "correctAnswer": "A",
  "explanation": "..."
}
```

### List User Quizzes

- Method: `GET`
- Path: `/quizzes`
- Auth required: Yes
- Response: saved quizzes (including linked document relation)

## 7. Progress API

All endpoints in this section require JWT.

### Get My Progress

- Method: `GET`
- Path: `/progress/me`
- Response: `UserProgress[]`

### Get Timeline for UI

- Method: `GET`
- Path: `/progress/timeline`
- Response:

```json
[
  {
    "documentId": "uuid",
    "fileName": "machine-learning.pdf",
    "status": "LOCKED",
    "score": 0
  }
]
```

Status values:
- `LOCKED`
- `IN_PROGRESS`
- `COMPLETED`

### Initialize Progress for a Document

- Method: `POST`
- Path: `/progress/init`
- Request body:

```json
{
  "documentId": "uuid"
}
```

Note:
- `userId` is taken from JWT, frontend must not send it.

### Complete Current Module

- Method: `POST`
- Path: `/progress/complete`
- Request body:

```json
{
  "documentId": "uuid",
  "score": 8.5
}
```

- Response: status update message, and may include `nextModule` if next lesson is unlocked.

## 8. RAG API (Knowledge Ingestion)

### Upload PDF to Vector Store

- Method: `POST`
- Path: `/rag/upload`
- Content-Type: `multipart/form-data`
- Form-data:
  - `file`: PDF file
- Response:

```json
{
  "success": true,
  "chunks": 42
}
```

### Ingest Plain Text

- Method: `POST`
- Path: `/rag/ingest-text`
- Request body:

```json
{
  "text": "Knowledge content to ingest",
  "source": "lecture-note-week-1"
}
```

- Response:

```json
{
  "success": true,
  "chunks": 12
}
```

## 9. AI API (RAG Generation with Phi-3)

### Ask AI with Retrieved Context

- Method: `POST`
- Path: `/ai/ask`
- Request body:

```json
{
  "question": "What is overfitting?"
}
```

- Response:

```json
{
  "answer": "...",
  "sources": ["machine-learning.pdf", "lecture-note-week-1"]
}
```

## 10. Legacy Chat API

### Simple Chat Endpoint

- Method: `POST`
- Path: `/chat/ask`
- Request body:

```json
{
  "message": "Hello"
}
```

- Response:

```json
{
  "answer": "..."
}
```

Important notes:
- `ChatService` still has a hard-coded `YOUR_API_KEY` in source.
- This endpoint is useful for quick tests, not recommended as the main production flow.

## 11. Health Check

- Method: `GET`
- Path: `/`
- Response text: `Hello World!`

## 12. Main Data Models

### User

```json
{
  "id": "uuid",
  "email": "student@example.com",
  "fullName": "Nguyen Van A",
  "avatar": "...",
  "provider": "local",
  "googleId": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Document

```json
{
  "id": "uuid",
  "fileName": "machine-learning.pdf",
  "fileSize": 1234567,
  "filePath": "...",
  "contentText": "...",
  "summary": "...",
  "status": "PROCESSING | SUMMARIZING | COMPLETED | FAILED",
  "createdAt": "...",
  "user": { "id": "uuid" }
}
```

### ChatMessage

```json
{
  "id": "uuid",
  "question": "...",
  "answer": "...",
  "createdAt": "...",
  "user": { "id": "uuid" },
  "document": { "id": "uuid" }
}
```

### UserProgress

```json
{
  "id": "uuid",
  "userId": "uuid",
  "document": { "id": "uuid", "fileName": "..." },
  "isCompleted": false,
  "isLocked": true,
  "highestScore": 8.5
}
```

### Quiz

```json
{
  "id": "uuid",
  "questions": [
    {
      "question": "...",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correctAnswer": "A",
      "explanation": "..."
    }
  ],
  "createdAt": "...",
  "user": { "id": "uuid" },
  "document": { "id": "uuid" }
}
```

## 13. Mapping to Your LLM + RAG Operation Plan

Current implementation maps to your plan as follows:

1. Ingestion:
   - `/documents/upload` for file storage + extraction + summary
   - `/rag/upload` for chunking + embeddings + PGVector write
2. Vector storage:
   - PGVector table: `english_knowledge`
3. Retrieval:
   - `RagService.getRelevantContext()` fetches top-k relevant chunks
4. Generation:
   - `/ai/ask` for Phi-3 + retrieved context + sources
   - `/documents/:id/chat` for Gemini + document text context

## 14. Recommended Frontend Endpoint Priority

1. Auth:
   - `/auth/register`
   - `/auth/login`
2. Document management:
   - `/documents/upload`
   - `/documents`
   - `/documents/:id`
3. Learning flow:
   - `/documents/:id/chat`
   - `/documents/:id/history`
   - `/quizzes/generate/:documentId`
   - `/quizzes`
   - `/progress/timeline`
4. Advanced RAG/LLM:
   - `/rag/upload`
   - `/rag/ingest-text`
   - `/ai/ask`

---

If you want, the next step is generating an OpenAPI document (Swagger YAML/JSON) from this spec so your frontend AI can auto-generate Retrofit service clients.