# Phase 2 - Core Business Modules

Phase 2 implements operational modules for project publishing, investment
creation, payment session initialization, media progress updates, and
notification preferences.

## Deliverables completed

- Backend API modules:
  - Projects
  - Investments
  - Payments (provider-ready abstractions for Stripe/Paystack)
  - Notifications
- Database migration:
  - `backend/migrations/002_phase2_core_modules.sql`
- Frontend pages:
  - `/projects`
  - `/projects/[projectId]`
  - `/notifications`
  - `/payments/checkout/[providerReference]`
- Automated tests:
  - `backend/tests/phase2.routes.test.js`
  - `frontend/src/lib/auth.test.ts`

## Phase 2 backend endpoints

### Projects

- `GET /api/v1/projects`
- `GET /api/v1/projects/:projectId`
- `POST /api/v1/projects` (developer/admin)
- `GET /api/v1/projects/:projectId/updates`
- `POST /api/v1/projects/:projectId/updates` (project owner/admin)

### Investments

- `POST /api/v1/investments`
- `GET /api/v1/investments/me`
- `GET /api/v1/investments/:investmentId`

### Payments

- `POST /api/v1/payments/initialize`
- `GET /api/v1/payments/:transactionId`
- `POST /api/v1/payments/webhook/:provider`

Webhook signatures (integration iteration):

- Stripe: `stripe-signature`
- Paystack: `x-paystack-signature`

### Notifications

- `GET /api/v1/notifications/me`
- `GET /api/v1/notifications/preferences`
- `PUT /api/v1/notifications/preferences`
- `POST /api/v1/notifications/test`

## Data and migration changes

Migration `002_phase2_core_modules.sql` introduces:

- `notification_preferences` table
- JSON metadata support in `notifications`
- provider checkout + idempotency tracking columns in `payment_transactions`
- status and access indexes for operational queries

## Security and behavior

- Role-aware authorization in services (investor/developer/admin)
- Ownership checks for investment and payment access
- Webhook secret validation for payment status updates
- Notification preference filtering before delivery persistence
