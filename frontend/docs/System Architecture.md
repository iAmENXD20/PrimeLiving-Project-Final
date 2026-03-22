# PrimeLiving V3 — System Architecture

---

## System Overview

PrimeLiving V3 is a property management system with four user roles: Admin, Owner, Manager, and Tenant.

---

## Frontend

React, TypeScript, Vite, TailwindCSS, React Router DOM, Supabase JS, Radix UI, Lucide React, React Hook Form, Zod, Recharts, Sonner, date-fns, jsPDF, Vitest

**Dashboards:** Admin, Owner, Manager, Tenant

---

## Backend

Node.js, Express, TypeScript, Helmet, CORS, Compression, Morgan, Zod, Supabase JS, Vitest

---

## Database and Authentication

Supabase (PostgreSQL, JWT Auth, Storage, Email)

---

## External Services

- **PhilSMS** — SMS notifications
- **Abstract API** — Email validation
- **PSGC API** — Philippine geographic data (cities, barangays)

---

## Connections

- **Frontend → Backend** — The React frontend sends REST API requests to the Express backend over HTTPS.
- **Frontend → Supabase** — The frontend connects directly to Supabase for authentication (login, signup, session management).
- **Frontend → PSGC API** — The frontend calls PSGC API directly to load Philippine city and barangay dropdowns on the inquiry form.
- **Backend → Supabase Database** — The backend reads and writes all data (owners, tenants, apartments, payments, etc.) to Supabase PostgreSQL.
- **Backend → Supabase Auth** — The backend verifies JWT tokens and creates user accounts through Supabase Auth.
- **Backend → Supabase Storage** — The backend stores QR receipt images in Supabase Storage.
- **Backend → Supabase Email** — Supabase sends emails automatically for account activation, email verification, owner invites, and password resets.
- **Backend → PhilSMS** — The backend sends SMS notifications to Philippine phone numbers for tenant creation, maintenance updates, payment confirmations, announcements, and invitations.
- **Backend → Abstract API** — The backend validates email addresses during signup and inquiry submission using Abstract API.
- **Supabase** — Database, authentication, file storage, email service

---

## Payments

Manual (Cash / QR) — No third-party payment gateway
