# AI Study Buddy Backend

NestJS backend for AI Study Buddy.

This service supports:
- Auth with JWT
- Document upload and AI summarization
- Account-scoped conversation history
- Account-scoped conversation deletion
- Quiz generation and persistence
- Study plan generation and artifact persistence
- Progress timeline and lesson history
- RAG ingestion and QA using local Ollama models

## Tech Stack

- NestJS + TypeScript
- PostgreSQL + TypeORM
- Local AI via Ollama
- RAG vector store (PGVector, with in-memory fallback)

## Local AI Configuration

Preferred local profile:
- Quantization: `Q4_K_M`
- Text model: `qwen2.5:14b-instruct`
- Vision model: `llama3.2-vision:11b`

See `.env.example` for environment variables.

## Quick Start

Install dependencies:

```bash
npm install
```

Run in dev:

```bash
npm run start:dev
```

Build:

```bash
npm run build
```

Run tests:

```bash
npm run test
npm run test:e2e
```

## Environment Notes

Main DB uses `DB_*` variables.

RAG vector DB uses `DATABASE_URL`.

In local development, keep both pointed to the same PostgreSQL instance unless intentionally separated.

## Auth and Upload Rule

`POST /documents/upload` requires JWT.

Flow:
1. Login with `POST /auth/login`
2. Save `access_token` on client
3. Send `Authorization: Bearer <access_token>` when uploading PDF

Token is client-side session data, not a database row.

## FE API Docs (Canonical)

Read these in order:
1. `FE_API_INDEX.md`
2. `FE_AUTH_PASSWORD_APIS.md`
3. `FE_CONVERSATION_HISTORY_QUIZ_PLAN.md`
4. `FE_PROGRESS_JSON_API_GUIDE.md`
5. `FE_DELETE_CHAT_ENDPOINT_SYNC.md`

Short token-upload fix note:
- Covered in `FE_API_INDEX.md` and `FE_AUTH_PASSWORD_APIS.md`

Alignment recommendations for FE team:
- `FE_BE_ALIGNMENT_RECOMMENDATIONS.md`

## API Testing

You can test APIs with:
- Bruno collection folder: `bruno/`
- Postman collection (if available in repo)

Use Bruno/Postman for team-shared API verification and quick contract checks.

### Postman Quick Test: Delete Chat

For fast FE/QA verification of deleting a conversation:
- Collection: `postman/AI-Study-Buddy-Delete-Chat-Quick.postman_collection.json`
- Environment: `postman/AI-Study-Buddy-Delete-Chat-Quick.local.postman_environment.json`
- Guide: `postman/README_DELETE_CHAT_QUICK_TEST.md`

Quick run flow:
1. Login
2. Get conversations
3. Delete one conversation
4. Verify deleted conversation no longer appears

### Conversation Delete Endpoint

- Method: `DELETE`
- Path: `/conversations/:conversationId`
- Auth: `Bearer <access_token>`
- Ownership rule: only conversations that belong to the current user can be deleted.

Response examples:
- `200 OK` with message `Conversation deleted successfully.`
- `404 Not Found` when conversation does not exist or is not owned by current user.

## License

MIT
