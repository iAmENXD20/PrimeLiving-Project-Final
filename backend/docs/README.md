# Backend Documentation

This folder documents backend system behavior by feature.

## Feature docs

- [Authentication](./features/authentication.md)
- [Clients & Owners](./features/clients-owners.md)
- [Managers](./features/managers.md)
- [Apartments & Units](./features/apartments-units.md)
- [Tenants](./features/tenants.md)
- [Payments & Billing](./features/payments-billing.md)
- [Maintenance](./features/maintenance.md)
- [Announcements](./features/announcements.md)
- [Notifications & SMS](./features/notifications-sms.md)
- [Documents](./features/documents.md)
- [Analytics](./features/analytics.md)
- [Inquiries](./features/inquiries.md)
- [Testing](./features/testing.md)

## Notes

- Controllers live in `backend/src/controllers/*`.
- Shared helpers and side effects are in `backend/src/utils/*`.
- Supabase/Postgres is the system of record.
