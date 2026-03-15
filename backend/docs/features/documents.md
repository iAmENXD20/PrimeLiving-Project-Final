# Documents

## Purpose

Stores and serves tenant/owner operational documents.

## Main endpoints

- `GET /api/documents`
- `GET /api/documents/:id`
- `POST /api/documents`
- `POST /api/documents/upload`
- `DELETE /api/documents/:id`

## How it works

1. Upload endpoint validates required payload fields.
2. Document metadata is stored in database and linked by tenant/client context.
3. Read filtering enforces role-appropriate visibility.
4. Tenant-side listings depend on tenant/account context and current access rules.

## Important behavior

- Validation message and status codes are standardized.
- Document listing logic was adjusted to avoid unintended tenant visibility regressions.
