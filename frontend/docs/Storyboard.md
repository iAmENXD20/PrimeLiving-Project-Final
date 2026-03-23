# PrimeLiving V3 — User Storyboard

PrimeLiving V3 is a web-based apartment management system designed for property owners in the Philippines. It streamlines tenant management, rent collection, maintenance tracking, and communication across four user roles: **Admin**, **Apartment Owner**, **Apartment Manager**, and **Tenant**. A fifth user type — the **Prospective Owner** — can submit an inquiry through the public landing page to request an account.

---

## External Entities and Services

| Entity | Purpose |
|--------|---------|
| **Supabase PostgreSQL** | Stores all application data — users, apartments, units, tenants, payments, maintenance requests, announcements, documents, activity logs, and inquiries. |
| **Supabase Auth** | Handles user authentication (login, signup, password reset, session management) using JWT tokens. |
| **Supabase Storage** | Stores uploaded files — QR code images, payment receipts, maintenance photos, and PDF documents. |
| **Supabase SMTP** | Sends invitation emails for account activation and password reset emails. |
| **Semaphore** |
Sends SMS notifications to Philippine phone numbers for tenant creation, maintenance updates, payment confirmations, and announcements. |
| **Abstract API** | Validates email addresses during inquiry submission and account creation (format, domain, mailbox, uniqueness). |
| **PSGC API** | Provides Philippine geographic data (province, city/municipality, barangay) for location dropdown menus in the inquiry form and address fields. |

---

## 1. Admin

The Admin is the system administrator who oversees the entire platform. The Admin does not manage individual apartments — instead, they control who gets access to the system.

1. **Login** — Admin enters email and password → **Supabase Auth** verifies credentials and returns a session → the system redirects to the Admin Dashboard.
2. **Dashboard** — Views a system-wide overview including total apartment owners, total tenants, pending inquiries, and user distribution charts → data loaded from **Supabase PostgreSQL**.
3. **Inquiry Management** — Reviews all inquiry submissions from the public landing page → data loaded from **Supabase PostgreSQL**.
   - Filters inquiries by status: Pending, Approved, or Cancelled.
   - Opens an inquiry to view full contact information, property details, and location.
   - **Approve** →
     - Email is validated via **Abstract API** (format, domain, mailbox, uniqueness)
     - A new user account is created in **Supabase Auth** → invitation email sent via **Supabase SMTP**
     - Owner, apartment, and unit records are created in **Supabase PostgreSQL**
     - The generated login credentials are displayed on screen
   - **Cancel** — Inquiry status is updated to "cancelled" in **Supabase PostgreSQL**; no account is created.
4. **Apartment Owner Management** — Views all registered apartment owners with search and city filter → data loaded from **Supabase PostgreSQL**. Can view owner details including personal info, property info, tenant/manager counts, join date, and account status.
5. **Account Settings** — Can view admin email and change password → password updated via **Supabase Auth**.

---

## 2. Apartment Owner

The Apartment Owner manages their own property — units, managers, tenants, payments, documents, and announcements. Their account is created by the Admin through inquiry approval.

**Account Activation:**
- Receives an invitation email via **Supabase SMTP** after Admin approval.
- Clicks the activation link, sets a secure password (minimum 8 characters with letter, number, and special character) → account activated in **Supabase Auth**.

**After Login** (authenticated via **Supabase Auth**):

1. **Dashboard** — Views active tenants, total revenue (filterable by month/year), unit count, pending maintenance requests, apartment address, and recent maintenance activity → all data from **Supabase PostgreSQL**.
2. **Unit Management** — Views all apartment units with an occupancy chart (occupied vs. vacant) → data from **Supabase PostgreSQL**. Can delete units. Unit creation and editing are handled by the manager.
3. **Manager Management** — Manages apartment managers assigned to the property.
   - **Add Manager** — Enters first name, last name, email, and phone number → user account created in **Supabase Auth** → invitation email sent via **Supabase SMTP** → manager record saved to **Supabase PostgreSQL**. The generated credentials are displayed on screen.
   - **Edit Manager** — Updates name, email, or phone → record updated in **Supabase PostgreSQL**.
   - **Delete Manager** — Manager record removed from **Supabase PostgreSQL** and auth account removed from **Supabase Auth**.
4. **Tenant Overview** — Views all tenants (active and inactive) with their assigned unit and rent information → data from **Supabase PostgreSQL**. Read-only; the manager handles tenant creation.
5. **Payments and Billing**
   - Views all payment records with search, status filter, and month/year picker → data from **Supabase PostgreSQL**.
   - Views a 12-month revenue trend chart and summary cards.
   - Uploads a QR code image (for GCash or Maya) → stored in **Supabase Storage**.
   - Can delete the QR code from **Supabase Storage** and update payment statuses in **Supabase PostgreSQL**.
6. **Documents** — Views and downloads all uploaded documents → files served from **Supabase Storage**.
7. **Announcements** — Creates and deletes announcements → saved to **Supabase PostgreSQL**. SMS notifications sent to tenants via **Semaphore**.
8. **Maintenance Requests** — Views all maintenance requests submitted by tenants → data from **Supabase PostgreSQL**. Search and filter by status and priority. Read-only; the manager handles status updates. Can send alerts to the manager.
9. **Activity Logs** — Views a complete history of all owner and manager actions with field-level change tracking → data from the `apartment_logs` table in **Supabase PostgreSQL**.
   - Can search, filter by role or date range, download logs as an Excel file, and clear all logs.
10. **Account Settings** — Views profile info from **Supabase PostgreSQL**. Can update phone number, update address (location data from **PSGC API**), and change password via **Supabase Auth**.

---

## 3. Apartment Manager

The Apartment Manager is assigned to a specific property by the owner. They handle day-to-day operations: managing tenants, verifying payments, handling maintenance requests, posting announcements, and uploading documents.

**Account Activation:**
- Receives an invitation email via **Supabase SMTP** after being added by the Apartment Owner.
- Clicks the activation link, sets a password → account activated in **Supabase Auth**.

**After Login** (authenticated via **Supabase Auth**):

1. **Dashboard** — Views active tenants, pending maintenance requests, paid vs. unpaid tenants, apartment address, and recent maintenance activity → all data from **Supabase PostgreSQL**.
2. **Maintenance Management** — Views all maintenance requests with search and status/priority filters → data from **Supabase PostgreSQL**.
   - Can view tenant-submitted photos in an expandable gallery → images from **Supabase Storage**.
   - Updates request status step by step: **Pending → In Progress → Resolved → Closed** → status updated in **Supabase PostgreSQL**.
   - Each status change triggers an SMS via **Semaphore** and an in-app notification to the tenant.
3. **Unit Management** — Views all units as cards showing occupancy, tenant name, phone, rent, and move-in date → data from **Supabase PostgreSQL**.
   - Can edit unit details (name, monthly rent, billing start date) → updated in **Supabase PostgreSQL**.
   - Can assign, change, or remove tenants in a unit.
4. **Tenant Management** — Full control over tenants within the assigned property.
   - **Add Tenant** — Enters first name, last name, email, and phone → email validated via **Abstract API** → user account created in **Supabase Auth** → invitation email sent via **Supabase SMTP** → tenant record saved to **Supabase PostgreSQL**. The generated credentials are displayed on screen.
   - **Edit Tenant** — Updates name, email, or phone → record updated in **Supabase PostgreSQL**.
   - **Delete Tenant** — Tenant record removed from **Supabase PostgreSQL** and auth account removed from **Supabase Auth**.
5. **Announcements** — Creates and deletes announcements → saved to **Supabase PostgreSQL**.
   - Selects recipients (all tenants or specific tenants).
   - Notification created in **Supabase PostgreSQL**; SMS sent via **Semaphore** to recipients with phone numbers.
6. **Documents** — Uploads PDF documents assigned to specific tenants → files stored in **Supabase Storage**, metadata saved in **Supabase PostgreSQL**. Can download and delete documents. Uploading triggers a notification to the tenant.
7. **Payments**
   - Views all payment records → data from **Supabase PostgreSQL**.
   - Monthly billings are auto-generated for all active tenants in **Supabase PostgreSQL**.
   - **Pending Cash Verifications** — Reviews payment proofs uploaded by tenants (receipt images from **Supabase Storage**).
     - **Approve** — Status updated in **Supabase PostgreSQL**; revenue record created; SMS sent via **Semaphore** to the tenant.
     - **Reject** — Status updated in **Supabase PostgreSQL**; SMS sent via **Semaphore** to the tenant.
   - Can record walk-in cash payments manually → saved to **Supabase PostgreSQL**.
8. **Notifications** — Views all notifications → data from **Supabase PostgreSQL**. Can mark as read, mark all as read, delete individually, or delete all. Auto-polls every 30 seconds.
9. **Activity Logs** — Views all activity logs for the assigned property (read-only) → data from **Supabase PostgreSQL**. Can search, filter by role or date, and download as an Excel file. Cannot clear logs.
10. **Account Settings** — Views profile info from **Supabase PostgreSQL**. Can update phone number and change password via **Supabase Auth**.

---

## 4. Tenant

The Tenant is a resident who lives in one of the apartment units. They can view their rent status, submit payments, file maintenance requests, and read announcements. Their account is created by the Apartment Manager.

**Account Activation:**
- Receives an invitation email via **Supabase SMTP** after being added by the Apartment Manager.
- Clicks the activation link, sets a password → account activated in **Supabase Auth**.

**After Login** (authenticated via **Supabase Auth**):

1. **Dashboard** — Views pending and resolved maintenance requests, pending payments, unit name, monthly rent, and apartment address → all data from **Supabase PostgreSQL**.
2. **Maintenance Requests** — Views all personal maintenance requests and their statuses → data from **Supabase PostgreSQL**.
   - **Submit Request** — Enters subject, description, and priority level (Low, Medium, High, or Urgent). Can attach up to 4 photos → photos stored in **Supabase Storage**, request saved to **Supabase PostgreSQL**.
   - Submitting triggers an SMS via **Semaphore** and an in-app notification to all active managers.
   - Tracks request status: **Pending → In Progress → Resolved → Closed** (read-only; updated by the manager).
3. **Payments**
   - **Due Schedule** — Shows all pending and overdue billing periods → auto-generated in **Supabase PostgreSQL** based on the move-in date with a 3-day grace period.
   - **Pay Now** — Selects a billing period, chooses payment mode (GCash, Maya, Cash, or Bank Transfer), views the owner's QR code (from **Supabase Storage**), uploads a payment receipt image (stored in **Supabase Storage**), and submits → payment record saved to **Supabase PostgreSQL**. Enters "pending verification" state. Managers notified via **Semaphore** and in-app notification.
   - **Payment History** — Shows all payments with status (paid, pending, overdue) → data from **Supabase PostgreSQL**.
4. **Documents** — Views and downloads all documents assigned to the tenant → files from **Supabase Storage**. Read-only; the manager manages document uploads.
5. **Announcements** — Views announcements posted by the owner or manager → data from **Supabase PostgreSQL**.
6. **Notifications** — Views all notifications → data from **Supabase PostgreSQL**. Can mark as read, mark all as read, delete individually, or delete all. Auto-polls every 30 seconds.
7. **Account Settings** — Views profile info from **Supabase PostgreSQL**. Can update phone number and change password via **Supabase Auth**.
8. **FAQ** — A floating help button opens a modal with answers to common questions about paying rent, submitting maintenance requests, due dates, account updates, lease renewal, and move-out notices.

---

## 5. Prospective Apartment Owner (Public Inquiry)

Any visitor can apply to become an apartment owner through the PrimeLiving public landing page. No account is needed to submit an inquiry.

1. **Visit Landing Page** — The visitor arrives at the PrimeLiving public website.
2. **Fill Out Inquiry Form** — Enters personal details (name, email, phone) and property details (apartment name, number of units).
3. **Select Location** — Chooses province, city/municipality, and barangay from dropdown menus → location data loaded from **PSGC API**.
4. **Submit** — Email is validated via **Abstract API** → inquiry record saved to **Supabase PostgreSQL** with a "pending" status.
5. **Pending Review** — The inquiry appears in the Admin's inquiry list.
6. **Admin Decision** — The Admin reviews and either approves or cancels the inquiry.
   - **If Approved** → Email validated via **Abstract API** → user account created in **Supabase Auth** → invitation email sent via **Supabase SMTP** → owner, apartment, and unit records created in **Supabase PostgreSQL**.
   - **If Cancelled** → Inquiry status updated to "cancelled" in **Supabase PostgreSQL**. No account is created.
