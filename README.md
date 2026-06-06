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

This guide outlines the procedural steps required to deploy the backend application server and initialize a clean database instance from scratch using Docker.

### Prerequisites
Before proceeding, ensure the following system dependencies are installed on the host machine:
- **Node.js** (v18.x or later) and **npm** (v9.x or later)
- **Docker Desktop** or **Docker Engine** with **Docker Compose**

---

### Step 1: Clone and Install Dependencies
1. Navigate into the server directory and install the necessary dependencies (use `--legacy-peer-deps` to resolve peer dependency conflicts):
   ```bash
   cd server-study-buddy
   npm install --legacy-peer-deps
   ```

### Step 2: Establish Containerized Database Services (Docker Compose)
The application utilizes a containerized PostgreSQL instance pre-packaged with the `pgvector` extension to facilitate semantic search operations and embeddings management.
1. Spin up the database container services in detached mode using Docker Compose:
   ```bash
   docker-compose up -d
   ```
   *Note: This command downloads the `ankane/pgvector` image and exposes the database service on port `5433` (mapped from the container's native `5432` port) as defined in the [docker-compose.yml](./docker-compose.yml).*
2. Verify that the database container is operational:
   ```bash
   docker ps
   ```
   You should observe the container named `buddy-db` in an active, running state.

### Step 3: Configure Environment Parameters
1. Instantiate an active `.env` configuration file in the server root by duplicating the provided template:
   ```bash
   cp .env.example .env
   ```
2. Open the newly created `.env` file and verify that the database credentials align with the Docker service specifications:
   ```env
   PORT=3001
   DB_HOST=localhost
   DB_PORT=5433
   DB_USERNAME=postgres
   DB_PASSWORD=1
   DB_DATABASE=postgres
   DATABASE_URL=postgresql://postgres:1@localhost:5433/postgres
   OLLAMA_BASE_URL=http://localhost:11434
   ```

### Step 4: Initialize Vector Database Extensions
With the PostgreSQL container active, execute the bootstrap script to register the essential vector extensions within the database schema:
```bash
node scripts/enable-pgvector.js
```
*Note: This script establishes the `vector` extension (`CREATE EXTENSION IF NOT EXISTS vector;`), enabling the database to store high-dimensional embeddings.*

### Step 5: Start the Application Server
The TypeORM integration is configured to automatically synchronize the entity definitions and construct the database schema on boot for a seamless, fresh setup.
- **Development Environment (Hot-Reloading)**:
  ```bash
  npm run start:dev
  ```
- **Production Compilation & Boot**:
  ```bash
  npm run build
  ```
  ```bash
  npm run start:prod
  ```
The service will bootstrap and begin listening for API requests on `http://localhost:3001` (or your configured `PORT`).

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
