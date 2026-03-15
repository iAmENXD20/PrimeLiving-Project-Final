# Managers

## Purpose

Manages manager accounts and assignment scope under owner/client context.

## Main endpoints

- `GET /api/managers`
- `GET /api/managers/:id`
- `GET /api/managers/by-auth/:authUserId`
- `POST /api/managers`
- `PUT /api/managers/:id`
- `DELETE /api/managers/:id`
- `GET /api/managers/count`

## How it works

1. Manager invite is created through Supabase auth.
2. Manager row is inserted in `managers` with role-related metadata.
3. Management operations support filtering by `client_id`.
4. Deletion/update endpoints are used by owner/admin workflows.

## Important behavior

- Manager lifecycle supports pending/active style states.
- Manager data is used by maintenance/payment notification fanout.
- Manager dashboard data is scoped through client/unit relationships.
