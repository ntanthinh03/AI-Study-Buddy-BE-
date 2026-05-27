# Buddy App: Backend Application Server

This repository contains the backend server for the AI Study Buddy platform, a production-grade API and real-time synchronization server built with the NestJS framework. The server interfaces with PostgreSQL for relational and semantic search operations (utilizing PGVector) and integrates local large language models (via Ollama) to support automated educational content generation, spaced repetition scheduling, and conversational Retrieval-Augmented Generation (RAG).

---

## System Capabilities

The backend application exposes REST endpoints and Socket.IO gateways to coordinate the system state:

### 1. User Account & Security Services
- JSON Web Token (JWT) credentials containing automated refresh tokens.
- Secure user registration, credential hashing (bcrypt), and account recovery using automated email OTP generation.
- **Advanced Profile Security Node**: High-security updates for sensitive identity records (email and phone number) via Brevo-generated 6-digit transaction OTPs delivered directly to the user's active, verified email address.

### 2. Intelligent Document Processing & RAG
- PDF text extraction and processing pipelines.
- Vector embeddings generation and database synchronization utilizing the PostgreSQL PGVector extension.
- Similarity search operations matching vector spaces to extract context for conversational AI prompts.

### 3. Spaced Repetition & Study Systems
- Leitner-based card scheduling calculations tracking memory box intervals.
- **Randomized Daily Quiz Engine**: Queries a set of exactly 20 randomized questions from the `QuestionPool` (using database-level `RANDOM()` ordering, prioritizing unused elements) to generate one completed session per day, preventing quiz fatigue and minimizing resource overhead.

### 4. Real-Time Collaboration Gateway
- WebSocket namespaces managing multiplayer focus groups and co-study environments.
- Live competitive quiz rooms handling simultaneous player scoring, response validation, and leaderboard synchronization.

---

## Technology Stack

- **Framework**: NestJS (TypeScript-based enterprise server)
- **Database**: PostgreSQL (relational model) and PGVector (embedding search)
- **ORM**: TypeORM
- **AI Processing**: Ollama (model: `phi3:medium-128k`) integrated via LangChain
- **Real-Time Layer**: Socket.IO
- **Email Delivery**: Brevo (SMTP Transactional Mailer API)

---

## Directory Structure

```
server-study-buddy/src/
├── app.module.ts                 # Main application root module
├── main.ts                       # Application entry point
├── auth/                         # Core authentication and OTP modules
├── users/                        # User registration and profile services
├── documents/                    # File upload, text parser, and asset controllers
├── chat/                         # Conversational memory and RAG endpoints
├── modules/
│   ├── study-sessions/           # Daily quizzes and gamification engines
│   ├── flashcards/               # Leitner scheduling algorithms
│   ├── ai/                       # Local model generation drivers
│   ├── rag/                      # Similarity search matching algorithms
│   ├── study-rooms/              # Live WebSocket lobbies and quiz rooms
│   └── analytics/                # Study log aggregation pipelines
└── common/                       # Config definitions, constants, and global interceptors
```

---

## Technical Deployment and Integration Guide

### Step 1: Install Dependencies and Set Up Environment
1. Clone the repository and execute installation:
   ```bash
   cd server-study-buddy
   npm install
   ```
2. Create a `.env` configuration file in the backend root based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Ensure key parameters are set:
   ```env
   PORT=3001
   DB_HOST=localhost
   DB_PORT=5433
   DB_USERNAME=postgres
   DB_PASSWORD=your_password
   DB_DATABASE=postgres
   DATABASE_URL=postgresql://postgres:your_password@localhost:5433/postgres
   OLLAMA_BASE_URL=http://localhost:11434
   BREVO_API_KEY=your_brevo_key
   BREVO_FROM_EMAIL=your_sender_email
   ```

### Step 2: Initialize Database Extensions
1. Ensure your PostgreSQL instance is running.
2. Execute the setup script to register the PGVector extension on your database:
   ```bash
   node scripts/enable-pgvector.js
   ```

### Step 3: Run the Server
- **Development**:
  ```bash
  npm run start:dev
  ```
- **Production Compilation**:
  ```bash
  npm run build
  ```
  The service boots on `http://localhost:3001` by default.

---

## API Documentation and Integration Contracts

Below are the key endpoints exposed for client integration (e.g., for the `FEBuddy` application):

### Authentication & Profile Management
- `POST /auth/register` — Create user profile.
- `POST /auth/login` — Exchange credentials for access token.
- `GET /auth/profile` — Retrieve current scholar profile parameters.
- `POST /auth/profile/update-major` — Instantly switch selected major domain.
- `POST /auth/profile/update-avatar` — Save Base64 profile avatar asset.
- `POST /auth/profile/send-otp` — Generate and send a 6-digit Brevo OTP verification code to the active account email.
- `POST /auth/profile/verify-otp` — Verify the 6-digit OTP code to commit email or phone number modifications.

### Flashcard & Study Management
- `POST /flashcards/generate` — Generate study cards from an uploaded document.
- `GET /flashcards/to-review` — Retrieve due flashcards using Leitner schedule.
- `POST /study-sessions/daily` — Generate daily progress session.
- `POST /study-sessions/:id/submit` — Submit quiz metrics and award experience points.

### RAG and Document Chat
- `POST /documents/upload` — Ingest PDF/Image files.
- `POST /chat` — Post conversational query matching vector context.

---

## Gamification Calculations

- **Experience Points (XP)**: Earned based on quiz performance:
  $$\text{XP} = (\text{Correct Answers} \times 10) + \text{Base Completion Bonus}$$
- **Level Calculation**: Level scales incrementally based on cumulative XP:
  $$\text{Level} = \left\lfloor \frac{\text{Total XP}}{100} \right\rfloor + 1$$
