# Tenant Dashboard

## Purpose

Self-service portal for tenant operational tasks.

## Main modules

- `src/pages/TenantDashboard.tsx`
- `src/components/tenant/*`
- `src/lib/tenantApi.ts`

## Feature areas

- Due schedule and payment proof submission
- Maintenance request creation and status tracking
- Announcement and notification feed
- Documents viewing
- Tenant account/settings

## How it works

1. Tenant profile is resolved from auth mapping.
2. Tabs fetch tenant/client/unit-scoped data via `tenantApi`.
3. Upload actions (receipts/photos) call backend upload endpoints and refresh state.

## Important behavior

- Tenant payment flows include pending verification handling.
- Tenant document/notification visibility depends on backend access rules.
