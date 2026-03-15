# PrimeLiving Database ERD and Explanation

This document explains the current PrimeLiving database design in ERD format for panel presentation and research paper use.

## 1) ERD (Current Canonical Model)

```mermaid
erDiagram
    CLIENTS {
      uuid id PK
      uuid auth_user_id
      text name
      text email
      text status
    }

    MANAGERS {
      uuid id PK
      uuid auth_user_id
      uuid client_id FK
      text status
    }

    APARTMENTS {
      uuid id PK
      uuid client_id FK
      text name
      text address
      text status
    }

    UNITS {
      uuid id PK
      uuid apartment_id FK
      uuid client_id FK
      uuid manager_id FK
      numeric monthly_rent
      text status
      int payment_due_day
    }

    TENANTS {
      uuid id PK
      uuid auth_user_id
      uuid client_id FK
      uuid unit_id FK
      uuid apartment_id FK
      text status
      timestamptz move_in_date
    }

    PAYMENTS {
      uuid id PK
      uuid client_id FK
      uuid tenant_id FK
      uuid unit_id FK
      uuid apartment_id FK
      numeric amount
      text status
      text verification_status
      date period_from
      date period_to
    }

    MAINTENANCE {
      uuid id PK
      uuid client_id FK
      uuid tenant_id FK
      uuid unit_id FK
      uuid apartment_id FK
      text priority
      text status
    }

    REVENUES {
      uuid id PK
      uuid client_id FK
      uuid unit_id FK
      uuid apartment_id FK
      numeric amount
      date month
    }

    DOCUMENTS {
      uuid id PK
      uuid client_id FK
      uuid tenant_id FK
      uuid unit_id FK
      uuid apartment_id FK
      uuid uploaded_by FK
      text file_name
    }

    ANNOUNCEMENTS {
      uuid id PK
      uuid client_id FK
      uuid apartment_id FK
      uuid[] recipient_tenant_ids
      text title
    }

    NOTIFICATIONS {
      uuid id PK
      uuid client_id FK
      uuid apartment_id FK
      uuid unit_id FK
      text recipient_role
      uuid recipient_id
      bool is_read
    }

    SMS_LOGS {
      uuid id PK
      uuid client_id FK
      uuid apartment_id FK
      uuid unit_id FK
      text phone
      text status
    }

    INQUIRIES {
      uuid id PK
      text name
      text email
      text status
    }

    CLIENTS ||--o{ MANAGERS : has
    CLIENTS ||--o{ APARTMENTS : owns
    APARTMENTS ||--o{ UNITS : contains
    MANAGERS ||--o{ UNITS : manages

    CLIENTS ||--o{ TENANTS : scopes
    UNITS ||--o{ TENANTS : assigned_to

    CLIENTS ||--o{ PAYMENTS : billed_under
    TENANTS ||--o{ PAYMENTS : pays
    UNITS ||--o{ PAYMENTS : billed_for

    CLIENTS ||--o{ MAINTENANCE : owns_scope
    TENANTS ||--o{ MAINTENANCE : files
    UNITS ||--o{ MAINTENANCE : unit_issue

    CLIENTS ||--o{ REVENUES : records
    UNITS ||--o{ REVENUES : source_unit

    CLIENTS ||--o{ DOCUMENTS : owns
    TENANTS ||--o{ DOCUMENTS : for_tenant
    UNITS ||--o{ DOCUMENTS : for_unit
    MANAGERS ||--o{ DOCUMENTS : uploads

    CLIENTS ||--o{ ANNOUNCEMENTS : publishes
    APARTMENTS ||--o{ ANNOUNCEMENTS : scoped_to

    CLIENTS ||--o{ NOTIFICATIONS : generates
    APARTMENTS ||--o{ NOTIFICATIONS : scoped_to

    CLIENTS ||--o{ SMS_LOGS : generates
    APARTMENTS ||--o{ SMS_LOGS : scoped_to
```

## 2) Presentation Explanation (Panel-Friendly)

PrimeLiving is a role-based rental operations system. The database is organized around three layers:

1. **Ownership layer** (`clients`, `managers`)
2. **Property inventory layer** (`apartments`, `units`)
3. **Operational transaction layer** (`tenants`, `payments`, `maintenance`, `documents`, `revenues`, `announcements`, `notifications`, `sms_logs`)

The key structural rule is:

- **`apartments` represent the property/building level**
- **`units` represent rentable spaces inside a property**

This removes ambiguity and gives clear reporting boundaries.

## 3) Cardinality and Relationship Logic

- One `client` (owner) can own many `apartments`.
- One `apartment` can contain many `units`.
- One `unit` can be managed by one `manager` at a time.
- One `unit` can have tenant assignments over time (`tenants` lifecycle).
- Payments, maintenance, documents, and revenues are linked to `unit_id` for precise operational tracking.
- Announcements, notifications, and SMS logs can be scoped at property level using `apartment_id`.

## 4) Why this ERD is good for the system

### a) Clarity

Separating building-level and unit-level entities avoids duplicate/inconsistent address and rent context.

### b) Scalability

A single owner can manage multiple properties and many units without changing core schema design.

### c) Auditability

Operational tables preserve context (`client_id`, `unit_id`, optional `apartment_id`) which improves reporting and traceability.

### d) Role-based operations

The data model cleanly supports admin, owner, manager, and tenant workflows.

## 5) Notes for Research Paper

You can describe this ERD as a **normalized transactional property management model** with:

- ownership hierarchy,
- inventory hierarchy,
- and role-driven operational transactions.

You can also mention that some legacy compatibility columns (for migration continuity) may still exist in selected tables, but **canonical runtime references use `unit_id` for operations and `apartment_id` for property-level communication scope**.

## 6) Suggested Defense Script (Short)

"Our ERD is designed around ownership, inventory, and transaction layers. We separate properties (`apartments`) from rentable spaces (`units`) so each operational record points to the correct level of granularity. Tenant, payment, maintenance, and revenue records are unit-scoped for precision, while announcements and notification channels can be property-scoped. This design improves consistency, report accuracy, and maintainability for multi-role property operations."