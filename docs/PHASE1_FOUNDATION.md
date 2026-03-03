# Phase 1 - Foundation Deliverables

This document captures the completed Phase 1 foundation for the Botch Build platform:

- Monorepo structure (Next.js frontend + Express backend)
- PostgreSQL foundation schema and migration runner
- JWT authentication and TOTP 2FA support
- Local Docker Compose environment
- Test suites and setup documentation

## Repository structure

```text
.
├── backend
│   ├── migrations
│   │   └── 001_phase1_foundation.sql
│   ├── src
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/env.js
│   │   ├── db
│   │   │   ├── index.js
│   │   │   └── migrate.js
│   │   ├── middleware
│   │   │   ├── authenticate.js
│   │   │   └── errorHandler.js
│   │   ├── modules
│   │   │   ├── auth
│   │   │   ├── health
│   │   │   └── user
│   │   └── utils
│   └── tests
├── frontend
│   ├── src
│   │   ├── app
│   │   │   ├── auth
│   │   │   ├── dashboard
│   │   │   └── page.tsx
│   │   └── lib
│   └── vitest.config.ts
├── docker-compose.yml
└── docs/PHASE1_FOUNDATION.md
```

## Phase 1 backend APIs

### Auth endpoints

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/2fa/setup` (requires bearer token)
- `POST /api/v1/auth/2fa/verify-setup` (requires bearer token)
- `POST /api/v1/auth/2fa/verify-login`

### User endpoint

- `GET /api/v1/users/me` (requires bearer token)

## Security foundations in this phase

- Password hashing with `bcryptjs` (12 rounds)
- JWT access tokens with audience + issuer checks
- Separate short-lived JWT token for 2FA login challenge
- TOTP 2FA (`speakeasy`) + QR provisioning (`qrcode`)
- Basic rate limiting and security headers (`helmet`)

## Database schema in this phase

Core tables and enums are included for platform modules:

- `users`
- `two_factor_secrets`
- `projects`
- `investments`
- `payment_transactions`
- `project_media_updates`
- `notifications`

## Test suites

- Backend unit/integration-style tests (Jest + Supertest):
  - `backend/tests/auth.service.test.js`
  - `backend/tests/auth.routes.test.js`
- Frontend utility tests (Vitest):
  - `frontend/src/lib/api.test.ts`
