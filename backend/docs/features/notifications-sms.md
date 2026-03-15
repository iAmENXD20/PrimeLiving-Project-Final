# Notifications & SMS

## Purpose

Provides in-app notification operations and SMS dispatch helpers.

## Main endpoints

- `GET /api/notifications`
- `PUT /api/notifications/:id/read`
- `PUT /api/notifications/read-all`
- `DELETE /api/notifications/:id`
- `DELETE /api/notifications/all`
- `POST /api/notifications/test-sms`
- `GET /api/notifications/sms-config-status`

## How it works

1. Notification records are created by feature modules (payments, maintenance, announcements).
2. Query endpoint supports recipient/client/apartment filters.
3. Mark-read/delete endpoints support single and bulk operations.
4. SMS utility writes to logs and sends through configured provider.

## Important behavior

- Bulk endpoints require `recipient_role` and `recipient_id`.
- Notification/SMS helpers resolve context (`client_id`, `unit_id`, `apartment_id`) for consistent auditability.
