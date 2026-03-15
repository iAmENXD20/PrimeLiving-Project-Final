# Owner Dashboard

## Purpose

Owner control panel for property operations and business outcomes.

## Main modules

- `src/pages/OwnerDashboard.tsx`
- `src/components/owner/*`
- `src/lib/ownerApi.ts`

## Feature areas

- Units/apartments management
- Manager account management
- Tenant/account visibility
- Payments and revenue tracking
- Maintenance status monitoring
- Owner announcements and document controls
- Owner account settings

## How it works

1. Owner context is resolved from auth user to client profile.
2. Owner tabs fetch scoped data using `ownerApi` wrappers.
3. Mutations update backend state and refresh local dashboard sections.

## Important behavior

- Canonical apartment/unit model is reflected in owner inventory screens.
- Owner operations can trigger manager/tenant notifications downstream.
