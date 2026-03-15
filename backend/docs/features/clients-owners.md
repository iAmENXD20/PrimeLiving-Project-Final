# Clients & Owners

## Purpose

Manages property-owner account records (`clients`) and owner-linked data.

## Main endpoints

- `GET /api/clients`
- `GET /api/clients/:id`
- `GET /api/clients/:id/location`
- `GET /api/clients/by-auth/:authUserId`
- `POST /api/clients`
- `PUT /api/clients/:id`
- `DELETE /api/clients/:id`
- `GET /api/clients/count`

## How it works

1. Owner creation validates email uniqueness.
2. Backend invites owner through Supabase auth email flow.
3. `clients` row is created and linked to `auth_user_id`.
4. Location access enforces requester-role checks (admin/owner/manager/tenant rules).

## Important behavior

- Owner duplication by email is blocked.
- `getClientLocation` requires authenticated and authorized user context.
- Client records are foundational for managers, units, tenants, payments, and analytics scoping.
