# Botch Build Platform (Phase 1 Foundation)

Secure, full-stack foundation for a diaspora-focused real estate investment
platform that supports:

- Investor/developer account onboarding
- JWT authentication
- Time-based one-time password (TOTP) 2FA
- PostgreSQL-backed domain schema
- Dockerized local development

## Tech stack

- **Frontend:** Next.js (App Router) + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Auth:** bcrypt + JWT + TOTP 2FA
- **Testing:** Jest/Supertest (backend), Vitest (frontend)

## Monorepo structure

```text
.
├── frontend
├── backend
├── docker-compose.yml
├── docs
└── README.md
```

## Quick start (Docker)

1. Copy environment defaults:

```bash
cp .env.example .env
```

2. Start all services:

```bash
docker compose up --build
```

3. Backend API: `http://localhost:4000`
4. Frontend app: `http://localhost:3000`

## Local development (without Docker)

### Prerequisites

- Node.js 22+
- PostgreSQL 16+

### Backend

```bash
cp backend/.env.example backend/.env
npm install --prefix backend
npm run migrate --prefix backend
npm run dev --prefix backend
```

### Frontend

```bash
cp frontend/.env.example frontend/.env.local
npm install --prefix frontend
npm run dev --prefix frontend
```

## Backend API summary

### Auth

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/2fa/setup` (Bearer token required)
- `POST /api/v1/auth/2fa/verify-setup` (Bearer token required)
- `POST /api/v1/auth/2fa/verify-login`

### User

- `GET /api/v1/users/me` (Bearer token required)

## Running test suites

```bash
npm run test --prefix backend
npm run test --prefix frontend
```

## Database migrations

Migrations are SQL-based and executed by:

```bash
npm run migrate --prefix backend
```

Current baseline migration:

- `backend/migrations/001_phase1_foundation.sql`

## Phase documentation

- `docs/PHASE1_FOUNDATION.md`
