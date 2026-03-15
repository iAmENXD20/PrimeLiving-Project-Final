# Analytics

## Purpose

Exposes dashboard metrics and distribution reports for admin/owner/manager views.

## Main endpoints (subset)

- `GET /api/analytics/overview`
- `GET /api/analytics/owner`
- `GET /api/analytics/client-detail`
- `GET /api/analytics/manager/:managerId`
- `GET /api/analytics/tenant`
- `GET /api/analytics/user-distribution`
- `GET /api/analytics/tenants-per-apartment`
- `GET /api/analytics/maintenance-by-month`

## How it works

1. Endpoints aggregate data from tenants, units, payments, maintenance, and users.
2. Client-scoped routes require `client_id` query context.
3. Outputs are shaped for dashboard widgets and chart components.
4. Manager-specific routes resolve managed unit scope then aggregate metrics.

## Important behavior

- Missing required query parameters return 400 with explicit message.
- Analytics joins and aliases follow canonical apartment/unit relationship model.
