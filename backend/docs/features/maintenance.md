# Maintenance

## Purpose

Handles maintenance request lifecycle from submission to resolution.

## Main endpoints

- `GET /api/maintenance`
- `GET /api/maintenance/:id`
- `POST /api/maintenance`
- `PUT /api/maintenance/:id/status`
- `GET /api/maintenance/count/pending`
- `POST /api/maintenance/upload-photo`

## How it works

1. Tenant submits request with title/description/priority (+ optional photo URL).
2. Request is stored in canonical `maintenance` table.
3. Manager notification/SMS fanout occurs using manager assignment or client scope.
4. Status updates propagate to tenant-facing notifications as applicable.

## Important behavior

- Upload endpoint validates `tenant_id` and image data.
- Status lifecycle powers owner/manager/tenant dashboard views.
