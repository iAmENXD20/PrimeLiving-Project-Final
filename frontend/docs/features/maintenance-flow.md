# Maintenance Flow

## Purpose

Documents request creation, triage, status updates, and visibility across roles.

## Frontend touchpoints

- Tenant maintenance tab (`TenantMaintenanceTab.tsx`)
- Manager maintenance tab (`ManagerMaintenanceTab.tsx`)
- Owner maintenance tab (`OwnerMaintenanceTab.tsx`)
- API wrappers in `tenantApi.ts`, `managerApi.ts`, `ownerApi.ts`

## Flow summary

1. Tenant creates a maintenance request (optionally with photo).
2. Manager sees pending queue and updates status.
3. Owner views overall maintenance performance and states.
4. Notifications/SMS keep recipients updated.

## Important behavior

- Priority and status fields drive UI badges/filtering.
- Upload helpers prepare files for backend image endpoints.
