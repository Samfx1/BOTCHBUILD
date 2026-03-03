# Phase 3 - Operations Hardening

This phase adds production-grade operational controls:

- Persistent background job queue with retry + backoff
- Webhook idempotency storage and deferred processing
- Audit trail for critical operations
- Admin operations API and worker process

## Database additions

Migration:

- `backend/migrations/003_phase3_operations_hardening.sql`

Tables:

- `operation_jobs`
- `payment_webhook_events`
- `audit_events`

## Queue and worker

Core modules:

- `backend/src/modules/jobs/jobs.repository.js`
- `backend/src/modules/jobs/jobs.service.js`
- `backend/src/workers/ops.worker.js`

Job types:

- `notification.dispatch`
- `payment.webhook.apply`
- `payment.reconcile.pending`

Retry behavior:

- Exponential backoff (30s, 60s, 120s ... capped at 1 hour)
- Dead-letter status when max attempts reached

## Webhook idempotency

Payment webhooks now:

1. Verify signature
2. Persist unique webhook event key (`provider + event_key`)
3. Enqueue processing job
4. Apply status updates in worker/admin process cycle

## Admin operations API

Routes (`/api/v1/ops`, admin-only):

- `GET /jobs`
- `POST /jobs/process`
- `GET /audit`
- `POST /reconciliation/payments`

## Frontend operations page

Added:

- `frontend/src/app/ops/page.tsx`

Capabilities:

- Process due jobs manually
- Enqueue reconciliation jobs
- Inspect recent jobs and audit events

## Environment additions

- `OPS_WORKER_POLL_MS`
- `OPS_WORKER_BATCH_SIZE`

Plus retained integration env vars for Stripe/Paystack, media storage, and
notification channels.
