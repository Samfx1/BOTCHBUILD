# Phase 2 - Integrations Iteration

This iteration extends Phase 2 core modules with provider integrations and
delivery adapters:

- Stripe and Paystack payment initialization adapters
- Signed webhook verification per provider
- Media upload target pipeline (local/S3/Cloudinary)
- Notification adapter dispatchers (email/SMS/WhatsApp/push)

## Payments integration

### Provider adapters

Files:

- `backend/src/modules/payments/gateways/stripe.gateway.js`
- `backend/src/modules/payments/gateways/paystack.gateway.js`
- `backend/src/modules/payments/gateways/index.js`

Behavior:

- `POST /api/v1/payments/initialize` now delegates checkout session creation to
  Stripe or Paystack adapters.
- Local development fallback returns mock checkout links when provider secrets
  are not configured.

### Signed webhooks

`POST /api/v1/payments/webhook/:provider` now verifies signatures:

- Stripe: `stripe-signature` + `STRIPE_WEBHOOK_SECRET`
- Paystack: `x-paystack-signature` HMAC SHA512 with `PAYSTACK_SECRET_KEY`

Webhook payload parsing updates transaction/payment states when events map to:

- `succeeded`
- `failed`
- `refunded`

## Media upload pipeline

Endpoint:

- `POST /api/v1/media/upload-target` (developer/admin auth required)

Adapters:

- Local (development fallback)
- S3 pre-signed PUT uploads
- Cloudinary signed POST uploads

Response includes target contract:

- provider
- storage key
- upload method details (`PUT` or `POST` fields)
- final public URL

## Notification provider adapters

Notification dispatchers now support channel adapters:

- Email (SMTP via Nodemailer)
- SMS (Twilio REST API)
- WhatsApp (Twilio REST API)
- Push (phase placeholder adapter)

If provider credentials are not set, adapters run in dry-run mode and persist
sent-like metadata for local development.

## New environment configuration

Added integration variables in `.env.example` and `backend/.env.example`:

- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Paystack: `PAYSTACK_SECRET_KEY`
- Media: `MEDIA_STORAGE_PROVIDER`, `AWS_*`, `CLOUDINARY_*`
- Notifications: `SMTP_*`, `TWILIO_*`
