# Buddy App - Backend (NestJS)

**AI-powered study backend with RAG, Spaced Repetition, and Gamification**

## Overview

The Buddy backend is a production-ready NestJS server that powers the AI Study Buddy mobile application. It provides REST APIs and WebSocket support for real-time features like multiplayer quizzes and co-study rooms. The backend integrates local AI models (Ollama) for content generation, PostgreSQL with PGVector for RAG capabilities, and comprehensive gamification systems.

## Key Features

### Authentication & Users
- JWT-based authentication with refresh tokens
- User registration and email verification
- Password management with OTP-based recovery
- Secure role-based access control

### Study Content Management
- **Daily Study Sessions** — Auto-generate personalized quiz questions and flashcards
- **Flashcard System** — Leitner box algorithm for spaced repetition
- **Question Pool** — Store and manage quiz questions with usage tracking
- **Study Activities** — Track all learning activities for analytics

### AI-Powered Learning
- **Quiz Generation** — AI creates diverse, contextual quiz questions from documents
- **Study Plan Generation** — Personalized learning roadmaps based on goals
- **Content Summarization** — Auto-generate summaries from uploaded materials
- **AI Chat** — Multi-turn conversations with RAG-enhanced context

### Document Management & RAG
- **Document Upload** — Support for PDF and image files
- **PDF Parsing** — Extract and process text from documents
- **Vector Storage** — Store embeddings in PostgreSQL with PGVector
- **Similarity Search** — Retrieve relevant context for RAG queries
- **Multi-document Chat** — Chat with knowledge across multiple documents

### Gamification
- **XP System** — Earn points for quiz answers, session completion, and focus time
- **Streaks** — Track daily study streaks and personal records
- **Leaderboard** — Global rankings based on accumulated XP
- **Level Progression** — Calculate user levels from experience

### Real-time Features
- **WebSocket Support** — Socket.IO for live multiplayer features
- **Study Rooms** — Real-time co-study and focus sessions
- **Live Quiz Challenges** — Synchronized multiplayer quizzes with instant scoring
- **Leaderboard Updates** — Real-time ranking updates during competitions

### Analytics & Progress
- **Activity Logging** — Track all study sessions and interactions
- **Daily Statistics** — Aggregate learning metrics by day
- **Progress Timeline** — Lesson completion and skill progression
- **Performance Metrics** — Accuracy rates, average scores, and trends

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | NestJS 11 with TypeScript |
| **Database** | PostgreSQL 14+ |
| **ORM** | TypeORM 0.3.28 |
| **Vector Store** | PGVector for embeddings |
| **AI** | Ollama (phi3:medium-128k) + LangChain 1.2 |
| **Real-time** | Socket.IO 4.8.3 |
| **Authentication** | JWT + Passport.js |
| **File Processing** | PDF parsing, image handling |
| **Cache** | Redis (optional fallback) |
| **Email** | Nodemailer for OTP delivery |
| **API Documentation** | Swagger/OpenAPI (via NestJS Swagger) |

## Project Structure

```
server-study-buddy/src/
├── app.module.ts                 # Root module
├── main.ts                       # Application entry point
├── auth/                         # Authentication module
│   ├── auth.service.ts
│   ├── jwt.strategy.ts
│   └── entities/
├── users/                        # User management
│   ├── users.service.ts
│   └── entities/
├── documents/                    # Document & Chat management
│   ├── documents.service.ts
│   ├── documents.controller.ts
│   └── entities/
├── chat/                         # Chat & RAG
│   ├── chat.service.ts
│   └── chat.controller.ts
├── modules/
│   ├── study-sessions/           # Daily sessions & gamification
│   │   ├── study-sessions.service.ts
│   │   ├── study-sessions.gateway.ts
│   │   └── entities/
│   ├── flashcards/               # Spaced repetition system
│   │   ├── flashcards.service.ts
│   │   └── entities/
│   ├── ai/                       # AI content generation
│   │   └── ai.service.ts
│   ├── rag/                      # Retrieval Augmented Generation
│   │   └── rag.service.ts
│   ├── study-rooms/              # Multiplayer features
│   │   └── study-rooms.gateway.ts
│   ├── analytics/                # Learning analytics
│   │   └── analytics.service.ts
│   └── progress/                 # Lesson progress tracking
│       └── progress.service.ts
├── common/
│   ├── config/                   # Environment configuration
│   ├── constants/                # Constants and messages
│   ├── services/                 # Shared services
│   ├── interceptors/             # Request/response interceptors
│   └── types/                    # TypeScript type definitions
└── test/                         # Test files
```

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+
- PostgreSQL 14+
- Ollama (for local AI)
- Docker (optional, for PostgreSQL in container)

## Installation & Setup

### 1. Clone and Install Dependencies
```bash
cd server-study-buddy
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key environment variables:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/buddy_db
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=buddy_db

# JWT
JWT_SECRET=your_secret_key_min_32_chars
JWT_EXPIRATION=3600

# AI & Ollama
OLLAMA_BASE_URL=http://localhost:11434
AI_MODEL=phi3:medium-128k

# Email (for OTP)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your_email@gmail.com
MAIL_PASS=your_app_password

# Server
PORT=3002
NODE_ENV=development
```

### 3. Setup PostgreSQL

**Option A: Using Docker**
```bash
docker run --name buddy-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=buddy_db \
  -p 5432:5432 \
  -d postgres:14-alpine

# Install PGVector
docker exec buddy-db psql -U postgres -d buddy_db \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

**Option B: Local PostgreSQL**
```bash
# Create database
psql -U postgres -c "CREATE DATABASE buddy_db;"

# Install PGVector extension
psql -U postgres -d buddy_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 4. Setup Ollama

```bash
# Download Ollama from https://ollama.ai
ollama pull phi3:medium-128k

# Start Ollama service
ollama serve
```

For vision features:
```bash
ollama pull llama3.2-vision:11b
```

### 5. Run Database Migrations

TypeORM auto-creates tables on startup. For manual migrations:

```bash
npm run typeorm migration:generate -- -n InitialSchema
npm run typeorm migration:run
```

### 6. Start the Server

**Development:**
```bash
npm run start:dev
```

**Production:**
```bash
npm run build
npm run start:prod
```

Server runs on `http://localhost:3002` by default.

## API Endpoints

### Authentication
- `POST /auth/register` — Create new user account
- `POST /auth/login` — Authenticate user
- `POST /auth/change-password` — Update password
- `POST /auth/forgot-password` — Initiate password recovery
- `POST /auth/verify-reset-otp` — Verify OTP and reset password

### Study Sessions
- `GET /study-sessions/daily` — Get or create today's session
- `POST /study-sessions/:id/submit` — Submit session results
- `GET /study-sessions/leaderboard` — Get top 50 users by XP

### Flashcards
- `POST /flashcards/generate` — Generate flashcards from document
- `GET /flashcards/to-review` — Get flashcards due for review
- `POST /flashcards/:id/review` — Record flashcard review result

### Documents
- `POST /documents/upload` — Upload PDF or image
- `GET /documents` — List user's documents
- `DELETE /documents/:id` — Delete document

### Chat
- `POST /chat` — Send message (with RAG context)
- `GET /conversations` — List conversations
- `GET /conversations/:id/messages` — Get conversation history
- `DELETE /conversations/:id` — Delete conversation

### AI Services
- `POST /ai/generate-quiz` — Generate quiz from content
- `POST /ai/generate-study-plan` — Generate study plan
- `POST /ai/summarize` — Generate content summary

### Analytics
- `GET /analytics/activity` — Get activity logs
- `GET /analytics/daily-stats` — Get daily statistics

### WebSocket (Study Rooms)
```typescript
// Connect
socket = io('http://localhost:3002/study-rooms')

// Events
socket.emit('joinRoom', { roomCode, username })
socket.emit('answerSubmit', { answer, timeRemainingRatio })
socket.on('leaderboardUpdate', (rankings) => {})
```

## Database Schema

### Key Entities

**User**
- id, email, password, name, createdAt

**UserStats** (Gamification)
- userId, totalXP, currentStreak, longestStreak, level, totalFocusTime

**StudySession**
- id, userId, status, content (JSONB quiz + flashcards), createdAt

**Flashcard** (SRS)
- id, userId, documentId, front, back, box, nextReview, createdAt

**QuestionPool**
- id, userId, documentId, type, data (JSONB), isUsed, createdAt

**Document**
- id, userId, title, summary, fileType, status, createdAt

**ChatMessage**
- id, conversationId, userId, content, messageType (text/quiz/plan), createdAt

**Conversation**
- id, userId, title, documentIds[], createdAt

## AI Configuration

### Supported Models

**Text Generation (Recommended)**
- `phi3:medium-128k` — Fast, efficient, good reasoning (default)
- `qwen2.5:14b-instruct` — Alternative, more powerful
- `llama2:13b` — Alternative, smaller

**Vision (Image Analysis)**
- `llama3.2-vision:11b` — For image questions and analysis

### Prompts

System prompts are configured in `src/common/constants/ai-prompts.ts`:

```typescript
// Quiz generation
GENERATE_QUIZ_SYSTEM_PROMPT: "You are an expert quiz creator..."

// Study plan generation
GENERATE_STUDY_PLAN_SYSTEM_PROMPT: "You are a learning coach..."

// Chat system context
CHAT_SYSTEM_PROMPT: "You are an AI study assistant..."
```

Modify these for different AI behavior.

## Gamification System

### XP Calculation
```typescript
// Quiz completion
xp = correct_answers * 10 + 20 // Base: 10 per correct, 20 completion bonus

// Focus session (25 min)
xp = 20

// Flashcard review
xp = 5 per successful review
```

### Level Calculation
```
Level = floor(totalXP / 100) + 1
```

### Streak Logic
- Increment on daily session completion
- Reset if user doesn't study for 24 hours
- Track both current and longest streak

## Testing

### Unit Tests
```bash
npm run test
```

### E2E Tests
```bash
npm run test:e2e
```

### API Testing with Bruno

```bash
# Install Bruno CLI (optional)
brew install bruno

# Test APIs from bruno/ folder
bruno run bruno/auth/login.bru
```

### Manual Testing

```bash
# Test login
curl -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Test daily session (with token)
curl -X GET http://localhost:3002/study-sessions/daily \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test leaderboard
curl http://localhost:3002/study-sessions/leaderboard
```

## Deployment

### Docker

```bash
# Build image
docker build -t buddy-backend .

# Run container
docker run -p 3002:3002 \
  -e DATABASE_URL=postgresql://... \
  -e OLLAMA_BASE_URL=http://ollama:11434 \
  buddy-backend
```

### Docker Compose

```bash
docker-compose up -d
```

See `docker-compose.yml` for full configuration.

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong JWT_SECRET
- [ ] Configure SSL/HTTPS
- [ ] Setup log aggregation
- [ ] Configure database backups
- [ ] Use managed Ollama service (or self-hosted)
- [ ] Setup monitoring and alerts
- [ ] Configure rate limiting
- [ ] Enable CORS for specific domains only

## Performance Optimization

- **Database Indexing:** Indexes on userId, createdAt, type fields
- **Query Caching:** Redis for frequently accessed data
- **Connection Pooling:** TypeORM connection pool configuration
- **Vector Search:** PGVector with IVFFLAT indexing for fast embeddings
- **Lazy Loading:** Relations loaded on demand

## Security

- **JWT Validation:** All protected routes validate token
- **Password Hashing:** bcrypt with salt rounds = 10
- **CORS:** Configured for specific frontend domains
- **Rate Limiting:** Implemented on auth endpoints
- **Input Validation:** DTO validation with class-validator
- **SQL Injection Prevention:** TypeORM parameterized queries
- **HTTPS:** Recommended for production

## Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
Solution: Ensure PostgreSQL is running, check DATABASE_URL

### Ollama Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:11434
```
Solution: Start Ollama service, verify OLLAMA_BASE_URL

### JWT Token Expired
Solution: Frontend should request new token using refresh endpoint

### Quiz Generation Timeout
Solution: Increase AI_TIMEOUT in .env, check Ollama performance

## Logging

Logs output to console in dev mode, file in production:

```bash
# View logs
tail -f logs/app.log

# Log levels: error, warn, log, debug, verbose
```

## Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Follow NestJS style guide
3. Add comprehensive error handling
4. Write unit tests for new features
5. Commit: `git commit -m "feat: description"`
6. Push and create PR

## Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [LangChain Documentation](https://python.langchain.com/)
- [Socket.IO Documentation](https://socket.io/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Ollama GitHub](https://github.com/jmorganca/ollama)

## Support & Issues

1. Check error logs: `npm run logs`
2. Review database state: `psql -U postgres -d buddy_db`
3. Test Ollama: `curl http://localhost:11434/api/tags`
4. Create GitHub issue with:
   - Error message
   - Steps to reproduce
   - Relevant logs
   - Environment details

---

**Version:** 1.0  
**Last Updated:** May 8, 2026  
**Maintained by:** Study Buddy Team

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
## Docs cleanup (2026-05-07)

Removed legacy FE documentation files from the repository:

- FE_API_INDEX.md
- FE_AUTH_PASSWORD_APIS.md
- FE_FORGOT_PASSWORD_OTP_APIS.md
- FE_PROGRESS_JSON_API_GUIDE.md
- FE_DATA_PERSISTENCE_CONTRACT.md
- FE_BE_ALIGNMENT_RECOMMENDATIONS.md
- FE_DISPLAY_NAMES_NOTE.md
- postman/README_DELETE_CHAT_QUICK_TEST.md

If you need any of these files, contact the frontend owner or check project backups.
