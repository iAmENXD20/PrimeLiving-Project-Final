# Apartments & Units

## Purpose

Handles rentable inventory using canonical model:

- `apartments` = property/building
- `units` = rentable units under a property

## Main endpoints

- `GET /api/apartments`
- `GET /api/apartments/:id`
- `POST /api/apartments`
- `POST /api/apartments/bulk`
- `PUT /api/apartments/:id`
- `DELETE /api/apartments/:id`
- `GET /api/apartments/with-tenants`
- `PUT /api/apartments/:id/payment-due-day`
- `GET /api/apartments/count`

## How it works

1. Unit operations run through `units` table.
2. Property-level details (like address) are sourced from `apartments`.
3. Response mappers flatten property address/name into unit payloads for UI convenience.
4. Payment due day supports per-unit or client-wide updates.

## Important behavior

- Compatibility-safe joins are used where unit/apartment context is needed.
- List endpoints support role and ownership filtering via query params.
