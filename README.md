# Botch Build Platform (Phases 1-3)

Secure, full-stack platform baseline for a diaspora-focused real estate
investment application that supports:

- Investor/developer account onboarding
- JWT authentication + TOTP 2FA
- Project creation and progress tracking
- Investment creation and payment initialization (Stripe/Paystack adapters)
- Signed Stripe/Paystack webhook processing
- Media upload target pipeline (local/S3/Cloudinary)
- Notification feeds, preferences, and provider adapters (email/SMS/WhatsApp)
- Operations hardening (job queue, idempotent webhooks, audit logs, worker)
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

### Projects

- `GET /api/v1/projects`
- `GET /api/v1/projects/:projectId`
- `POST /api/v1/projects` (developer/admin)
- `GET /api/v1/projects/:projectId/updates`
- `POST /api/v1/projects/:projectId/updates` (owner/admin)

### Investments

- `POST /api/v1/investments`
- `GET /api/v1/investments/me`
- `GET /api/v1/investments/:investmentId`

### Payments

- `POST /api/v1/payments/initialize`
- `GET /api/v1/payments/:transactionId`
- `POST /api/v1/payments/webhook/:provider`

Webhook signatures:

- Stripe: `stripe-signature`
- Paystack: `x-paystack-signature`

### Media

- `POST /api/v1/media/upload-target` (developer/admin)

### Notifications

- `GET /api/v1/notifications/me`
- `GET /api/v1/notifications/preferences`
- `PUT /api/v1/notifications/preferences`
- `POST /api/v1/notifications/test`

### Operations (admin)

- `GET /api/v1/ops/jobs`
- `POST /api/v1/ops/jobs/process`
- `GET /api/v1/ops/audit`
- `POST /api/v1/ops/reconciliation/payments`

## Running test suites

```bash
npm run test --prefix backend
npm run test --prefix frontend
```

## Background worker

Run queue processing worker:

```bash
npm run worker --prefix backend
```

The worker executes queued jobs for notification dispatch, payment webhook
processing, and reconciliation.

## Database migrations

Migrations are SQL-based and executed by:

```bash
npm run migrate --prefix backend
```

Current baseline migration:

- `backend/migrations/001_phase1_foundation.sql`
- `backend/migrations/002_phase2_core_modules.sql`
- `backend/migrations/003_phase3_operations_hardening.sql`

## Phase documentation

- `docs/PHASE1_FOUNDATION.md`
- `docs/PHASE2_CORE_MODULES.md`
- `docs/PHASE2_INTEGRATIONS.md`
- `docs/PHASE3_OPERATIONS_HARDENING.md`
