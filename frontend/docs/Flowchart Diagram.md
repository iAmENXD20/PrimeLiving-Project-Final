# PrimeLiving V3 — System Flowchart

PrimeLiving V3 is a web-based apartment management system designed for property owners in the Philippines. It streamlines tenant management, rent collection, maintenance tracking, and communication across four user roles: **Admin**, **Apartment Owner**, **Apartment Manager**, and **Tenant**. A fifth user type — the **Prospective Owner** — can submit an inquiry through the public landing page to request an account.

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React, TypeScript, Vite, TailwindCSS, React Router DOM, Radix UI, Lucide React, React Hook Form, Zod, Recharts, Sonner, date-fns, jsPDF, SheetJS (xlsx) |
| **Backend** | Node.js, Express, TypeScript, Helmet, CORS, Compression, Morgan, Zod |
| **Database & Auth** | Supabase (PostgreSQL, JWT Auth, Storage, Email/SMTP) |
| **Testing** | Vitest |

---

## External Entities

| Entity | Role | Interaction |
|--------|------|-------------|
| **Supabase** | Database, authentication, file storage, and email delivery | Stores all application data (owners, tenants, apartments, payments, logs). Handles user authentication via JWT. Stores uploaded files (QR codes, receipts, maintenance photos, documents). Sends invitation and password reset emails via custom SMTP. |
| **Semaphore** | SMS notification service | Sends SMS notifications to Philippine phone numbers for tenant creation, maintenance updates, payment confirmations, announcements, and account invitations. |
| **Abstract API** | Email validation service | Validates email addresses during inquiry submission and account creation by checking format, domain, mailbox existence, and uniqueness. |
| **PSGC API** | Philippine geographic data | Provides province, city/municipality, and barangay dropdown data for the inquiry form and address fields. Called directly from the frontend. |

---

## User Flows

---

### 1. Admin Flow

The Admin is the system administrator who oversees the entire platform. The Admin does not manage individual apartments — instead, they control who gets access to the system.

**Login → Dashboard**
1. Admin logs in using email and password.
2. System authenticates via **Supabase Auth**, verifies the role as "admin", and redirects to the Admin Dashboard.

**Dashboard**
- Views a system-wide overview including total apartment owners, total tenants, pending inquiries, and user distribution charts.

**Inquiry Management**
1. Views all inquiry submissions from the public landing page.
2. Filters inquiries by status: Pending, Approved, or Cancelled.
3. Opens an inquiry to view full contact information, property details, and location.
4. **Approve:**
   - System validates the applicant's email via **Abstract API** (format, domain, mailbox, uniqueness).
   - Creates a new user account in **Supabase Auth** (invitation email sent via **Supabase SMTP**).
   - Creates the apartment owner, apartment, and unit records in **Supabase PostgreSQL**.
   - The generated login credentials are displayed on screen.
5. **Cancel** — Marks the inquiry as cancelled; no account is created.

**Apartment Owner Management**
- Views all registered apartment owners with search and city filter.
- Can view owner details including personal info, property info, tenant/manager counts, join date, and account status.

**Account Settings**
- Can view admin email and change password (verified via **Supabase Auth**).

---

### 2. Apartment Owner Flow

The Apartment Owner manages their own property — units, managers, tenants, payments, documents, and announcements. Their account is created by the Admin through inquiry approval.

**Account Activation**
1. Receives an invitation email from **Supabase SMTP** after Admin approval.
2. Clicks the activation link and lands on the invite confirmation page.
3. Sets a secure password (minimum 8 characters with letter, number, and special character).
4. Account is activated in **Supabase Auth**.

**Login → Dashboard**
1. Logs in using email and password (authenticated via **Supabase Auth**).
2. System identifies the role as "owner" and redirects to the Owner Dashboard.

**Dashboard**
- Views active tenants, total revenue (filterable by month/year), unit count, pending maintenance requests, apartment address, and recent maintenance activity.

**Unit Management**
- Views all apartment units with an occupancy chart (occupied vs. vacant).
- Can delete units. Unit creation and editing are handled by the manager.

**Manager Management**
1. **Add Manager** — Enters first name, last name, email, and phone number.
   - System creates a user account in **Supabase Auth** (invitation email sent via **Supabase SMTP**).
   - Manager record created in **Supabase PostgreSQL**.
   - The generated credentials are displayed on screen.
2. **Edit Manager** — Updates name, email, or phone.
3. **Delete Manager** — Removes the manager record from the database and their **Supabase Auth** account.

**Tenant Overview**
- Views all tenants (active and inactive) with their assigned unit and rent information.
- Read-only; the manager handles tenant creation.

**Payments and Billing**
- Views all payment records with search, status filter, and month/year picker.
- Views a 12-month revenue trend chart and summary cards (rendered via **Recharts**).
- Uploads a QR code image (for GCash or Maya) stored in **Supabase Storage**.
- Can delete the QR code and update payment statuses.

**Documents**
- Views and downloads all uploaded documents (files served from **Supabase Storage**).

**Announcements**
- Creates and deletes announcements for tenants.
- Notifications sent to tenants; SMS sent via **Semaphore**.

**Maintenance Requests**
- Views all maintenance requests with search and filters by status and priority.
- Read-only; the manager handles status updates. Can send alerts to the manager.

**Activity Logs**
- Views a complete history of all owner and manager actions with field-level change tracking.
- Data retrieved from the `apartment_logs` table in **Supabase PostgreSQL**.
- Can search, filter by role or date range, download as an Excel file (via **SheetJS**), and clear all logs.

**Account Settings**
- Views profile info. Can update phone number, update address (location data from **PSGC API**), and change password (via **Supabase Auth**).

---

### 3. Apartment Manager Flow

The Apartment Manager is assigned to a specific property by the owner. They handle day-to-day operations: managing tenants, verifying payments, handling maintenance requests, posting announcements, and uploading documents.

**Account Activation**
1. Receives an invitation email from **Supabase SMTP** after being added by the Owner.
2. Clicks the activation link, sets a password, and activates the account in **Supabase Auth**.

**Login → Dashboard**
1. Logs in using email and password (authenticated via **Supabase Auth**).
2. System identifies the role as "manager" and redirects to the Manager Dashboard.

**Dashboard**
- Views active tenants, pending maintenance requests, paid vs. unpaid tenants, apartment address, and recent maintenance activity.

**Maintenance Management**
1. Views all maintenance requests with search and status/priority filters.
2. Can view tenant-submitted photos in an expandable gallery (images from **Supabase Storage**).
3. Updates request status step by step: **Pending → In Progress → Resolved → Closed**.
4. Each status change triggers an SMS via **Semaphore** and an in-app notification to the tenant.

**Unit Management**
- Views all units as cards showing occupancy, tenant name, phone, rent, and move-in date.
- Can edit unit details (name, monthly rent, billing start date).
- Can assign, change, or remove tenants in a unit.

**Tenant Management**
1. **Add Tenant** — Enters first name, last name, email, and phone.
   - Email validated via **Abstract API**.
   - User account created in **Supabase Auth** (invitation email sent via **Supabase SMTP**).
   - Tenant record created in **Supabase PostgreSQL**.
   - The generated credentials are displayed on screen.
2. **Edit Tenant** — Updates name, email, or phone.
3. **Delete Tenant** — Removes the tenant record and their **Supabase Auth** account.

**Announcements**
1. Creates announcements — selects recipients (all tenants or specific tenants).
2. In-app notification sent to each recipient.
3. SMS sent via **Semaphore** to recipients with phone numbers.
4. Can delete announcements.

**Documents**
- Uploads PDF documents assigned to specific tenants (stored in **Supabase Storage**).
- Can download and delete documents. Uploading triggers a notification to the tenant.

**Payments**
- Views all payment records with search, status filter, and month/year picker.
- Monthly billings are auto-generated for all active tenants (from **Supabase PostgreSQL**).
- **Pending Cash Verifications** — Reviews payment proofs uploaded by tenants.
  - **Approve** — Marks as verified and paid; creates a revenue record; sends SMS via **Semaphore** and notification to the tenant.
  - **Reject** — Marks as rejected; sends SMS via **Semaphore** and notification to the tenant.
- Can record walk-in cash payments manually.

**Notifications**
- Views all notifications (maintenance requests, owner announcements, payment proofs).
- Can mark as read, mark all as read, delete individually, or delete all.
- Auto-polls every 30 seconds for new notifications.

**Activity Logs**
- Views all activity logs for the assigned property (read-only).
- Can search, filter by role or date, and download as an Excel file (via **SheetJS**). Cannot clear logs.

**Account Settings**
- Views profile info. Can update phone number and change password (via **Supabase Auth**).

---

### 4. Tenant Flow

The Tenant is a resident in one of the apartment units. They can view their rent status, submit payments, file maintenance requests, and read announcements. Their account is created by the Apartment Manager.

**Account Activation**
1. Receives an invitation email from **Supabase SMTP** after being added by the Manager.
2. Clicks the activation link, sets a password, and activates the account in **Supabase Auth**.

**Login → Dashboard**
1. Logs in using email and password (authenticated via **Supabase Auth**).
2. System identifies the role as "tenant" and redirects to the Tenant Dashboard.

**Dashboard**
- Views pending and resolved maintenance requests, pending payments, unit name, monthly rent, and apartment address.

**Maintenance Requests**
1. Views all personal maintenance requests and their statuses.
2. **Submit Request** — Enters subject, description, and priority level (Low, Medium, High, or Urgent). Can attach up to 4 photos (stored in **Supabase Storage**).
3. Submitting triggers an SMS via **Semaphore** and an in-app notification to all active managers.
4. Tracks request status: **Pending → In Progress → Resolved → Closed** (read-only; updated by the manager).

**Payments**
1. **Due Schedule** — Shows all pending and overdue billing periods, auto-generated based on the move-in date with a 3-day grace period before marking as overdue.
2. **Pay Now** — Selects a billing period, chooses payment mode (GCash, Maya, Cash, or Bank Transfer), views the owner's QR code (from **Supabase Storage**), uploads a payment receipt image (stored in **Supabase Storage**), and submits.
3. Payment enters "pending verification" state until approved or rejected by the manager. Managers are notified via SMS (**Semaphore**) and in-app notification.
4. **Payment History** — Shows all payments with status (paid, pending, overdue).

**Documents**
- Views and downloads all documents assigned to the tenant (files served from **Supabase Storage**).
- Read-only; the manager manages document uploads.

**Announcements**
- Views announcements posted by the owner or manager.

**Notifications**
- Views all notifications (announcements, maintenance updates, payment verifications).
- Can mark as read, mark all as read, delete individually, or delete all.
- Auto-polls every 30 seconds for new notifications.

**Account Settings**
- Views profile info. Can update phone number and change password (via **Supabase Auth**).

**FAQ**
- A floating help button opens a modal with answers to common questions about paying rent, submitting maintenance requests, due dates, account updates, lease renewal, and move-out notices.

---

### 5. Prospective Apartment Owner Flow (Public Inquiry)

Any visitor can apply to become an apartment owner through the PrimeLiving public landing page. No account is needed.

1. **Visit Landing Page** — The visitor arrives at the PrimeLiving public website.
2. **Fill Out Inquiry Form** — Enters personal details (name, email, phone) and property details (apartment name, number of units).
3. **Select Location** — Chooses province, city/municipality, and barangay from dropdown menus (data from **PSGC API**).
4. **Submit** — Email is validated via **Abstract API**. The inquiry is saved in **Supabase PostgreSQL** with a "pending" status.
5. **Pending Review** — The inquiry appears in the Admin's inquiry list.
6. **Admin Decision:**
   - **Approved** — Owner account, apartment, and units are created. An invitation email is sent via **Supabase SMTP**.
   - **Cancelled** — Inquiry is marked as cancelled. No account is created.

---

## Data Flow Summary

```
┌──────────────┐       REST API        ┌──────────────┐
│   Frontend   │ ────────────────────►  │   Backend    │
│  (React App) │ ◄────────────────────  │  (Express)   │
└──────┬───────┘                        └──────┬───────┘
       │                                       │
       │  Direct Auth                          │  Data / Auth / Storage
       │                                       │
       ▼                                       ▼
┌──────────────┐                        ┌──────────────┐
│  Supabase    │                        │  Supabase    │
│  (Auth only) │                        │  (Full)      │
└──────────────┘                        │  - PostgreSQL│
                                        │  - Auth      │
┌──────────────┐                        │  - Storage   │
│  PSGC API    │ ◄── Frontend direct    │  - SMTP      │
│  (Locations) │                        └──────┬───────┘
└──────────────┘                               │
                                               │  SMS
                                               ▼
                                        ┌──────────────┐
                                        │   Semaphore    │
                                        └──────────────┘

                                        ┌──────────────┐
                                        │ Abstract API │
                                        │ (Email Check)│
                                        └──────────────┘
```
