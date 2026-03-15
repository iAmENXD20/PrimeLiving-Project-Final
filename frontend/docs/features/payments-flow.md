# Payments Flow

## Purpose

Covers owner/manager/tenant payment interactions and UI behavior.

## Frontend touchpoints

- Owner/manager payment tabs (`components/owner/*Payments*`, `components/manager/*Payments*`)
- Tenant payment tab (`components/tenant/TenantPaymentsTab.tsx`)
- API wrappers in `ownerApi.ts`, `managerApi.ts`, `tenantApi.ts`

## Flow summary

1. Tenant sees due schedule and payment history.
2. Tenant submits receipt/payment proof.
3. Manager reviews pending verification queue.
4. Approval/rejection updates status and downstream notifications.
5. Owner sees updated payment/revenue outcomes.

## Important behavior

- Payment QR fetch/upload/delete is supported for owner-side collection flows.
- Frontend status presentation depends on backend verification/status fields.
