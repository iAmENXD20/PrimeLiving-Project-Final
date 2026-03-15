# Admin Dashboard

## Purpose

Provides platform-level management and monitoring UI.

## Main modules

- `src/pages/AdminDashboard.tsx`
- `src/components/admin/*`
- `src/lib/api.ts`

## Feature areas

- Overview stats
- Clients management
- Managers/users monitoring
- Inquiries triage
- Analytics summaries
- Admin account settings

## How it works

1. Dashboard loads aggregate metrics and list data from backend admin endpoints.
2. Tab components isolate CRUD and analytics concerns.
3. Shared UI and pagination components keep table/list behavior consistent.

## Important behavior

- Admin screens are the broadest visibility scope.
- Pending inquiries and user distribution metrics are surfaced for operational follow-up.
