# PrimeLiving V3 — Flowchart Diagram

---

## 1. Admin Flow

- Admin account is pre-seeded in the system
- Admin logs in with email and password
- Supabase Auth verifies credentials and returns JWT token
- System identifies role as "admin" and redirects to Admin Dashboard

**Overview:**
- Views total users, apartment owners, tenants, and pending inquiries
- Views user distribution chart and recent inquiries

**Inquiries:**
- Views all inquiry submissions from the landing page
- Filters by: All, Pending, History (Approved/Cancelled)
- Opens inquiry detail to review full contact and property information
- Can mark inquiry as "Responded"
- Can approve inquiry:
  - System validates email (format, domain, mailbox, uniqueness)
  - Creates Supabase Auth account for the new owner (email invite sent)
  - Creates apartment owner record in database
  - Creates apartment record
  - Auto-creates unit records based on number of units
  - Inquiry status updated to "approved"
  - Generated credentials displayed to admin
- Can cancel inquiry → status set to "cancelled"

**Apartment Owners:**
- Views all apartment owners with search and filter by city
- Opens owner detail to see personal info, property info, tenant/manager counts, join date, and status
- Cannot create, edit, or delete owners directly (owners are created through inquiry approval)

**Account:**
- Views admin email
- Can change password (current → new → confirm)

---

## 2. Apartment Owner Flow

- Account created by Admin through inquiry approval
- Receives invitation email from Supabase
- Clicks link and lands on invite confirmation page
- Sets password (min 8 characters, must contain letter, number, and special character)
- Account activated
- Logs in with email and password
- System identifies role as "owner" and redirects to Owner Dashboard

**Overview:**
- Views active tenants count, total revenue (filterable by month/year), units count, and pending maintenance count
- Views apartment address and recent maintenance requests

**Manage Apartment — Units:**
- Views all units with occupancy chart (occupied vs vacant)
- Can delete units
- Cannot create or edit units (manager handles that)

**Manage Apartment — Managers:**
- Views all managers with search
- Can create manager:
  - Enters first name, last name, email, phone
  - System creates Supabase Auth account (invitation email sent to manager)
  - Manager record created with status "pending"
  - Generated credentials displayed
- Can edit manager (name, email, phone)
- Can delete manager (removes record and Supabase Auth account)

**Manage Apartment — Tenants:**
- Views all tenants (active and inactive) with unit and rent info
- Read-only view (manager handles tenant creation and management)

**Maintenance:**
- Views all maintenance requests with search and status/priority filters
- Read-only (manager handles status updates)
- Can alert manager about a specific issue (creates an announcement notification for the manager)

**Payments:**
- Views all payment records with search, status filter, and month/year picker
- Views revenue trend chart (12-month bar chart) and summary cards
- Can upload QR code image for tenants to scan (max 5MB)
- Can delete QR code
- Can update payment status (mark overdue)

**Documents:**
- Views all documents with search
- Can download documents
- Read-only (manager uploads documents)

**Account:**
- Views profile info (name, email, phone, status, member since, units, managers, tenants)
- Can update phone number
- Can update address (street, barangay, city, province, zip with Philippine location autocomplete)
- Can change password (current → new → confirm)

---

## 3. Apartment Manager Flow

- Account created by Owner through Manage Apartment → Managers
- Receives invitation email from Supabase
- Clicks link and lands on invite confirmation page
- Sets password → account activated
- Logs in with email and password
- System identifies role as "manager" and redirects to Manager Dashboard

**Overview:**
- Views active tenants, pending maintenance requests, total paid tenants, and total unpaid tenants
- Views apartment address and recent maintenance requests

**Maintenance:**
- Views all maintenance requests with search and status/priority filters
- Can view tenant-submitted photos (expandable gallery with lightbox)
- Can update status step by step:
  - Pending → In Progress (Accept)
  - In Progress → Resolved (Mark Resolved)
  - Resolved → Closed (Close with confirmation)
- Each status change sends SMS and in-app notification to the tenant

**Manage Apartment — Units:**
- Views all units as cards with occupancy, tenant name, phone, rent, and move-in date
- Can edit unit (name, monthly rent, assign/change tenant, set billing start date)
- Can assign tenant to unit (select from unassigned tenants)
- Can remove tenant from unit (preserves tenant account)

**Manage Apartment — Tenants:**
- Views all tenants with search
- Can create tenant:
  - Enters first name, last name, email, phone
  - System validates email (format, deliverability, uniqueness)
  - Creates Supabase Auth account (invitation email sent to tenant)
  - Tenant record created
  - Generated credentials displayed
- Can edit tenant (name, email, phone)
- Can delete tenant (removes record and Supabase Auth account)

**Manage Apartment — Announcements:**
- Views all announcements
- Can create announcement:
  - Enters title and message
  - Selects recipients: all tenants or specific tenants
  - Sends in-app notification to each recipient
  - Sends SMS to tenants with phone numbers
- Can delete announcement

**Manage Apartment — Documents:**
- Views all documents with search
- Can upload document:
  - Selects PDF file (only PDF allowed)
  - Assigns to a specific tenant
  - Optional description
  - Creates notification to tenant ("New Document Received")
- Can delete document
- Can download documents

**Payments:**
- Views all payment records with search, status filter, and month/year picker
- System auto-generates monthly billings for all active tenants
- Pending cash verifications section:
  - Can approve payment → marks as "verified" and "paid", creates revenue record, sends SMS and notification to tenant
  - Can reject payment → marks as "rejected", sends SMS and notification to tenant
- Can record walk-in cash payment manually

**Notifications:**
- Views all notifications (maintenance requests, owner announcements, payment proofs)
- Can mark as read or mark all as read
- Can delete individual or delete all
- Auto-polls every 30 seconds for new notifications
- Browser push notifications supported

**Settings:**
- Views profile info (name, email, role, status, joined date, owner name, property address)
- Can update phone number
- Can change password (current → new → confirm)

---

## 4. Tenant Flow

- Account created by Manager through Manage Apartment → Tenants
- Receives invitation email from Supabase
- Clicks link and lands on invite confirmation page
- Sets password → account activated
- Logs in with email and password
- System identifies role as "tenant" and redirects to Tenant Dashboard

**Overview:**
- Views pending maintenance requests, resolved requests, and pending payments
- Views apartment info (unit name, monthly rent) and apartment address
- Views recent maintenance requests

**Maintenance:**
- Views all personal maintenance requests
- Can create maintenance request:
  - Enters subject, description, priority (low/medium/high/urgent)
  - Uploads up to 4 photos (max 5MB each)
  - Photos stored in Supabase Storage
  - Sends SMS and in-app notification to all active managers
- Tracks request status: pending → in progress → resolved → closed (read-only)

**Payments:**
- Due schedule section shows all pending and overdue billing periods (auto-generated based on move-in date, 3-day grace period for overdue)
- Pay now flow:
  - Selects a pending or overdue billing period
  - Uploads payment receipt image (max 5MB)
  - Can view owner's QR code for scanning
  - Submits payment proof
  - Sends SMS and in-app notification to all managers
  - Payment enters "pending verification" state
- Payment history shows all payments with status (paid, pending, overdue)
- Can upload and delete receipt images

**Documents:**
- Views all documents assigned to this tenant
- Can download documents
- Read-only (manager uploads and assigns)

**Notifications:**
- Views all notifications (announcements, maintenance updates, payment verifications)
- Can mark as read or mark all as read
- Can delete individual or delete all
- Auto-polls every 30 seconds
- Browser push notifications supported

**Account:**
- Views profile info (name, email, role, status, move-in date, unit name, owner name, property address)
- Can update phone number
- Can change password (current → new → confirm)

**FAQ:**
- Floating help button opens a modal with frequently asked questions about paying rent, submitting maintenance, due dates, account updates, lease renewal, and move-out notice
