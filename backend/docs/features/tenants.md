# Tenants

## Purpose

Manages tenant accounts, assignment to units, and tenant lifecycle transitions.

## Main endpoints

- `GET /api/tenants`
- `GET /api/tenants/:id`
- `GET /api/tenants/by-auth/:authUserId`
- `POST /api/tenants`
- `PUT /api/tenants/:id`
- `DELETE /api/tenants/:id`
- `POST /api/tenants/assign-unit`
- `POST /api/tenants/remove-from-unit`
- `GET /api/tenants/count`

## How it works

1. Tenant can be created with or without auth account invitation.
2. Assignment flow links tenant to unit and enforces valid move-in date semantics.
3. Existing active unit occupants can be deactivated/replaced per workflow.
4. Removal flow either preserves account (unit null) or deactivates tenant.

## Important behavior

- Assignment and account state affect payment and maintenance scope.
- Tenant status impacts dashboard and filtering behavior.
