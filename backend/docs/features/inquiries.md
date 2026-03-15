# Inquiries

## Purpose

Handles inbound inquiry submissions from public/landing flows and admin follow-up.

## Main endpoints

- `GET /api/inquiries`
- `GET /api/inquiries/:id`
- `POST /api/inquiries`
- `PUT /api/inquiries/:id/status`
- `GET /api/inquiries/count/pending`

## How it works

1. Public-facing forms post inquiry payload to backend.
2. Records are persisted with default pending status.
3. Admin/staff can change lifecycle state (responded/approved/cancelled/closed).
4. Pending count powers admin overview widgets.

## Important behavior

- Status updates are atomic by inquiry id.
- Query filtering by status is available for triage workflows.
