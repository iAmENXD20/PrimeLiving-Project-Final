# Payments & Billing

## Purpose

Implements billing generation, payment proof submission, verification, and QR payment flows.

## Main endpoints (subset)

- `GET /api/payments`
- `GET /api/payments/due-schedule/:tenantId`
- `POST /api/payments`
- `POST /api/payments/submit-proof`
- `PUT /api/payments/:id/verify`
- `POST /api/payments/generate-monthly`
- `GET /api/payments/pending-verifications`
- `POST/GET/DELETE /api/payments/qr/*`

## How it works

1. Monthly billing generation creates pending/overdue rows as needed.
2. Tenant receipt submission marks records for manager verification.
3. Verification updates payment state and may create revenue record when approved.
4. Notification/SMS utilities fan out updates to affected roles.
5. QR upload/sign/delete flows use Supabase Storage.

## Important behavior

- Required fields are validated on critical mutation routes.
- Billing and verification behavior is tenant/unit/client scoped.
- Non-GET mutations clear frontend API cache through frontend client wrapper behavior.
