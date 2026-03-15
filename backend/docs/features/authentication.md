# Authentication

## Purpose

Provides login/session-based access and password lifecycle endpoints.

## Main endpoints

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/reset-password`
- `PUT /api/auth/update-password`
- `GET /api/auth/me`

## How it works

1. Login calls Supabase auth sign-in and returns session/user data.
2. `getMe` returns the authenticated user attached by middleware.
3. Password reset/update flows are delegated to Supabase auth APIs.
4. Backend responses use standardized success/error helper format.

## Important behavior

- Unauthorized/invalid login maps to error responses.
- Password actions require valid user context where needed.
- Role-based authorization for feature routes is enforced outside auth controller in middleware/router composition.
