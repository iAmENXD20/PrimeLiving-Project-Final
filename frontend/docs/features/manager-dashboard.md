# Manager Dashboard

## Purpose

Execution-focused workspace for day-to-day rental operations.

## Main modules

- `src/pages/ManagerDashboard.tsx`
- `src/components/manager/*`
- `src/lib/managerApi.ts`

## Feature areas

- Managed units and tenant handling
- Maintenance queue and status updates
- Payment verification and cash settlement actions
- Announcements and notifications
- Document uploads and tenant account management
- Manager settings/account

## How it works

1. Manager context is resolved from auth user mapping.
2. Manager tabs request client/manager-scoped data via `managerApi`.
3. Actions (verify payment, update maintenance, etc.) trigger backend side effects and list refresh.

## Important behavior

- Manager workflows are bounded by ownership/assignment constraints.
- Notification lists support read/delete and bulk actions.
