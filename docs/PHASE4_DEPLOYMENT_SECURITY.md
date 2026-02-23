# Phase 4 - Deployment and Security Hardening

Phase 4 finalizes production-readiness controls for reliability, security, and
operations.

## Deliverables

- Production environment validation for secrets and public URLs
- Structured JSON logging with request correlation IDs
- Route-level and global rate limiting
- Liveness/readiness probes with database + queue checks
- CI pipeline for migrations, tests, lint, and builds

## Security hardening

### Environment validation

`backend/src/config/env.js` now performs extra checks in production:

- Rejects placeholder JWT/webhook secrets
- Requires at least one payment provider key configured
- Requires `STRIPE_WEBHOOK_SECRET` when Stripe is enabled
- Enforces HTTPS URLs for frontend/backend public endpoints

Production template:

- `backend/.env.production.example`

### API hardening

- `x-powered-by` disabled
- `trust proxy` enabled for reverse-proxy deployments
- CORS enforced via explicit allowlist (`CORS_ALLOWED_ORIGINS`)
- Helmet configured for API-safe defaults

### Rate limiting

Middleware:

- `globalLimiter`
- `authSensitiveLimiter`
- `writeActionLimiter`
- `webhookLimiter`
- `opsLimiter`

Applied across auth, write-heavy, webhook, and admin-ops routes.

## Observability

### Request correlation + structured logs

- Request IDs via `x-request-id`
- JSON logs for access, errors, and worker/server lifecycle events
- Error responses now include `requestId`

Key files:

- `backend/src/utils/logger.js`
- `backend/src/middleware/requestContext.js`
- `backend/src/middleware/accessLogger.js`
- `backend/src/middleware/errorHandler.js`

## Health probes

Routes:

- `GET /api/v1/health`
- `GET /api/v1/health/liveness`
- `GET /api/v1/health/readiness`

Readiness checks:

- Database connectivity
- Job queue dead-letter threshold (`OPS_DEAD_JOB_THRESHOLD`)

## CI/CD

GitHub Actions workflow:

- `.github/workflows/ci.yml`

Pipeline stages:

- Backend dependency install
- Migration execution against Postgres service
- Backend tests
- Frontend tests
- Frontend lint
- Frontend build
