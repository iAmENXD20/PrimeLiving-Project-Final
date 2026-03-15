# Announcements

## Purpose

Allows owners/managers to publish announcements scoped by client and optionally apartment/unit context.

## Main endpoints

- `GET /api/announcements`
- `GET /api/announcements/:id`
- `POST /api/announcements`
- `DELETE /api/announcements/:id`

## How it works

1. Announcement is created with sender context and scope fields.
2. Recipients are resolved from affected audience (tenant/manager side as needed).
3. Notification side effects are triggered through utility layer.
4. Read flows support role-aware filtering.

## Important behavior

- Apartment-scoped support is included in runtime and schema.
- Failure in insert path returns standardized API error payload.
