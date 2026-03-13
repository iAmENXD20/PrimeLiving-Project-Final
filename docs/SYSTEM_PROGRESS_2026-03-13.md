# PrimeLiving System Progress (As of 2026-03-13)

## 1) Authentication & Role Routing

### Completed
- Fixed non-admin role handling across frontend and backend:
  - Role normalization now supports `owner`, `manager`, `tenant`, and alias handling like `client -> owner`.
  - Added backend role fallback logic when JWT metadata is missing (derives role from profile tables).
- Strengthened login routing so dashboard redirects rely on normalized/verified role data.

### Impact
- Reduced cases where only admin could access data while other roles failed routing or authorization.

---

## 2) Inquiry Submission + Approval Flow

### Completed
- Fixed inquiry submission failures:
  - Resolved stale backend/runtime issues.
  - Applied DB schema fix for missing `inquiries.apartment_name` column.
- Improved inquiry approval order:
  - Account creation now happens before marking inquiry as approved.
  - Prevents inquiry status inconsistency when account creation fails.
- Added UI submit guard to avoid accidental duplicate submissions.

### Impact
- Inquiry create/approve path is now stable and less prone to duplicate side effects.

---

## 3) Owner Onboarding & Email Verification

### Completed
- Migrated owner onboarding to verification-first invite flow.
- Added invite-confirm page:
  - Route: `/invite/confirm`
  - Uses token hash verification and now includes password setup UI before redirecting to login.
- Added branded owner invite template file:
  - `backend/docs/OWNER_INVITE_TEMPLATE.html`
- Added duplicate owner pre-check before sending invite.
- Added invite redirect handling based on request origin (fallback to configured frontend URL).

### Important Notes
- The Supabase **Invite email template** in dashboard must match the provided template for the new confirmation route to work.
- Fresh invite links should be used (old tokens can expire/invalidated).

---

## 4) Manager & Tenant Account Creation

### Completed
- Manager account creation backend returns password fields with compatibility keys:
  - `generatedPassword`, `generated_password`, `password`
- Owner-side manager UI now handles missing/alternate password key safely and shows clear fallback error.

### Impact
- Improved reliability of credentials modal display after manager creation.

---

## 5) Payments QR Code Architecture (Major Upgrade)

### Previous State
- QR code was stored only in browser localStorage.
- Not shared reliably across devices/users.

### Completed Migration
- Implemented backend Supabase Storage support for payment QR codes (keyed by landlord/client primary key).
- Added secure QR endpoints under payments routes:
  - `GET /api/payments/qr/:clientId`
  - `POST /api/payments/qr`
  - `DELETE /api/payments/qr/:clientId`
- Added automatic storage bucket handling (`payment-qr-codes`).
- Updated owner and tenant frontend APIs/UI to use backend QR endpoints.
- Added local cache fallback to reduce QR disappearing during navigation/reload edge cases.

### Impact
- QR is now centralized and tenant-accessible across sessions/devices (not only current browser state).

---

## 6) Manager Announcement Recipient Picker (SMS Targeting UX)

### Completed
- Added dynamic recipient selection in manager announcements UI:
  - `all`, `multiple`, `specific`
- Added tenant selector list with phone visibility and skip messaging for tenants without phone.
- Improved tenant source fallback for recipient loading:
  - Uses manager-scoped apartment tenants first (`/apartments/with-tenants?manager_id=...`), then client-scoped tenants.
  - Added fallback resolution for missing manager `client_id`.
- Decoupled announcement and tenant loads using `Promise.allSettled` so one failure doesn't blank both.

### Current Investigation State
- User still reports empty recipient list in some manager sessions.
- Live DB check confirms tenant data exists for at least one manager client.
- Remaining likely issue: manager session/account mapping inconsistency (wrong manager account scope or missing manager-to-client/apartment linkage on the specific login account).

---

## 7) Database Architecture & Optimization

### Completed
- Added schema/performance hardening migration earlier in the session:
  - Foreign key indexes.
  - Numeric guard constraints.
- Added tenant query fallback logic (client filter now also considers apartment linkage for legacy rows missing `tenants.client_id`).

### Recommended Next DB Action
- Backfill `tenants.client_id` from `apartments.client_id` where null, then enforce stronger consistency.

---

## 8) Known Remaining Items / Pending

1. **Manager announcement recipient list still empty for some manager accounts**
   - Need to verify exact manager auth email and inspect linked manager/client/apartment rows for that account.

2. **Frontend TypeScript build warnings/errors (`lucide-react` declaration)**
   - Pre-existing issue not introduced by core logic changes.
   - Recommended fix: add a module declaration or adjust typing configuration.

3. **Real SMS delivery backend not yet implemented**
   - Current recipient flow in manager announcements is UI + simulated send behavior.
   - Production SMS should be implemented server-side using env-protected API key.

---

## 9) Files Added / Updated (Key Areas)

- Backend
  - `backend/src/controllers/clients.controller.ts`
  - `backend/src/controllers/payments.controller.ts`
  - `backend/src/controllers/tenants.controller.ts`
  - `backend/src/controllers/managers.controller.ts`
  - `backend/src/routes/payments.routes.ts`
  - `backend/src/app.ts` (CORS opened temporarily)

- Frontend
  - `frontend/src/pages/InviteConfirmPage.tsx`
  - `frontend/src/App.tsx`
  - `frontend/src/lib/api.ts`
  - `frontend/src/lib/ownerApi.ts`
  - `frontend/src/lib/tenantApi.ts`
  - `frontend/src/lib/managerApi.ts`
  - `frontend/src/components/admin/InquiriesTab.tsx`
  - `frontend/src/components/owner/OwnerPaymentsTab.tsx`
  - `frontend/src/components/tenant/TenantPaymentsTab.tsx`
  - `frontend/src/components/manager/ManagerAnnouncementsTab.tsx`
  - `frontend/src/components/manager/ManagerManageApartmentTab.tsx`

- Docs
  - `backend/docs/OWNER_INVITE_TEMPLATE.html`
  - `docs/SYSTEM_PROGRESS_2026-03-13.md`

---

## 10) Immediate Next Step Recommendation

- Validate the specific manager account currently testing announcements:
  1. Confirm manager login email.
  2. Confirm corresponding `managers.id`, `managers.client_id`.
  3. Confirm that manager has apartments or client-linked tenants.
  4. Re-test recipient picker after that mapping check.
