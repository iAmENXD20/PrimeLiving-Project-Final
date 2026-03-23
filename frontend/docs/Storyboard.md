# PrimeLiving V3 — User Storyboard

---

## 1. Admin

1. Admin logs in to the system
2. Views the Admin Dashboard with system overview
3. Reviews pending inquiries from public users
4. Approves or cancels inquiries
   - On approval: system creates the apartment owner account, apartment, and units automatically; SMS is sent with login credentials
   - On cancel: inquiry is marked as cancelled
5. Manages all apartment owners (view, edit, deactivate)
6. Views system-wide analytics and reports

---

## 2. Apartment Owner

1. Owner logs in to the system
2. Views the Owner Dashboard with stats and summary
3. Manages apartment units (create, edit, delete units with name, max occupancy, monthly rent)
4. Manages apartment managers (add, edit, remove managers assigned to their property)
5. Manages tenants (add, edit, remove tenants assigned to units)
6. Handles payments and billing
   - Views all payment records
   - Verifies or rejects payment proofs from tenants
   - Generates monthly billings
   - Uploads QR code for GCash payments
7. Manages documents (upload/delete PDF files per unit or tenant)
8. Creates and deletes announcements for tenants
9. Views maintenance requests submitted by tenants
10. Views activity logs (all owner/manager actions with field-level change tracking)
    - Can search, filter by role/date, and clear all logs

---

## 3. Apartment Manager

1. Manager logs in to the system
2. Views the Manager Dashboard with stats for assigned property
3. Manages tenants (add, edit, remove tenants in assigned units)
4. Handles payment verification
   - Views payment records
   - Verifies or rejects payment proofs submitted by tenants
   - Records cash payments manually
5. Manages maintenance requests
   - Views all requests for the assigned property
   - Updates status: Pending → In Progress → Resolved
   - Tenant receives SMS notification on status change
6. Creates and deletes announcements (SMS sent to tenants)
7. Manages documents (upload/delete PDF files)
8. Views activity logs (read-only — can search and filter, but cannot clear)

---

## 4. Tenant

1. Tenant logs in to the system
2. Views the Tenant Dashboard with unit info and rent status
3. Manages payments
   - Views payment history and upcoming bills
   - Submits payment via GCash QR code scan
   - Uploads payment receipt/proof
   - Receives SMS notification when payment is verified or rejected
4. Submits maintenance requests
   - Fills out request with title, description, and priority
   - Optionally attaches a photo
   - Manager and owner are notified via SMS
   - Receives SMS notification when status is updated
5. Views announcements posted by owner or manager

---

## 5. Possible apartment owner (inquiry)

1. Visits the PrimeLiving landing page
2. Fills out the inquiry form with personal and property details
3. Selects location (province, city/municipality, barangay)
4. Submits the inquiry
5. System validates the email address
6. Inquiry is saved as "pending" for admin review
7. Admin reviews and approves or cancels the inquiry
8. If approved: owner account is created and SMS with login credentials is sent
