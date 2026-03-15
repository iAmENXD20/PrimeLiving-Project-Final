# Documents Flow

## Purpose

Covers document listing, upload, and delete interactions.

## Frontend touchpoints

- Owner documents tab
- Manager documents tab
- Tenant documents tab
- API wrappers in role-specific modules

## Flow summary

1. Upload actions send metadata + file data payload to backend.
2. Listing calls return role-filtered document collections.
3. Delete actions remove records and refresh UI tables.

## Important behavior

- Tenant visibility depends on backend role and ownership filters.
- Frontend displays file metadata and links in role-specific formats.
