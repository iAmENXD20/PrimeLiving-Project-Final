# API Layers

## Purpose

Defines frontend data-access layers and separation of concerns.

## Main modules

- `src/lib/apiClient.ts` (core HTTP wrapper)
- `src/lib/api.ts` (admin/general endpoints)
- `src/lib/ownerApi.ts`
- `src/lib/managerApi.ts`
- `src/lib/tenantApi.ts`

## How it works

1. `apiClient` injects auth token and normalizes backend response handling.
2. GET requests support short-lived cache with optional skip controls.
3. Non-GET mutations clear cache to avoid stale reads.
4. Role-specific wrappers expose typed methods for dashboard components.

## Important behavior

- Error messages are surfaced from backend response payloads.
- API wrappers map backend DTOs to frontend-friendly shape where needed.
