# PrimeLiving V3 - SMS Integration & Notifications System

## 1. SMS INTEGRATION

### SMS Provider: Semaphore (Philippine SMS Gateway)

**Configuration Files:**
- [backend/src/config/env.ts](backend/src/config/env.ts#L12-L26)

**Environment Variables:**
```typescript
SEMAPHORE_API_KEY:        string           // Required for SMS delivery
SEMAPHORE_SENDER_NAME:    string           // Optional sender name
SEMAPHORE_API_URL:        string           // Default: https://api.semaphore.co/api/v4/messages
SMS_ENABLED:              string           // Can be "false" to disable SMS
```

**Key SMS Functions:**
- [backend/src/utils/sms.ts](backend/src/utils/sms.ts)

### SMS Core Implementation

```typescript
// Main SMS sending function
export async function sendSmsSemaphore(phone: string, message: string): Promise<void>

// Batch SMS sending
export async function sendSmsToMany(
  phones: Array<string | null | undefined>,
  message: string,
  context?: SmsContext
): Promise<void>
```

**Phone Number Normalization:**
- Accepts formats: 09XXXXXXXXX, +639XXXXXXXXX, 639XXXXXXXXX
- Converts to 63 prefix internally for API, then back to 09 for Semaphore
- Validates: Philippine mobile format `^63\d{10}$`
- Truncates messages to 160 chars (1 SMS credit) or breaks to multiple

**SMS Logging:**
- Logs all SMS attempts (sent/failed) to `sms_logs` table
- Records: phone, message, status, error, apartment_id, timestamp

---

## 2. NOTIFICATION TYPES & TRIGGERS

### Database Schema
- **Table:** `notifications`
- **Table:** `sms_logs` (SMS delivery audit trail)
- [Schema Definition](frontend/supabase/schema.v6.sql#L257-L280)

### Notification Interface
```typescript
interface Notification {
  id: string;
  apartmentowner_id: string | null;
  apartment_id: string | null;
  recipient_role: "manager" | "tenant";  // or "owner"
  recipient_id: string;
  type: string;                           // Notification type
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface SmsLog {
  id: string;
  phone: string;
  message: string;
  status: "sent" | "failed";
  error: string | null;
  apartment_id: string | null;
  created_at: string;
}
```

---

## 3. NOTIFICATION TRIGGERS BY FEATURE

### A. PAYMENT NOTIFICATIONS

**Triggered by:** Automated billing scheduler (hourly checks)
**File:** [backend/src/utils/billingScheduler.ts](backend/src/utils/billingScheduler.ts)

**Notification Types:**

1. **`payment_reminder`** (3 days before due date)
   - Recipients: Tenants
   - In-app: ✓ Yes
   - SMS: ✓ Yes
   - Message: "Your rent of ₱XXXX is due on [DATE]. Please settle your payment on time."

2. **`payment_overdue`** (Past due + 3-day grace period)
   - Recipients: Tenants + Managers
   - In-app: ✓ Yes
   - SMS: ✓ Yes (tenant only)
   - Message: "Your rent of ₱XXXX due on [DATE] is now overdue. Please settle immediately."

**Code Example:**
```typescript
// Create in-app notification
await createNotification({
  apartmentowner_id: tenant.apartmentowner_id || "",
  recipient_role: "tenant",
  recipient_id: payment.tenant_id,
  type: "payment_reminder",
  title: "Payment Reminder",
  message: `Your rent of ₱${payment.amount.toLocaleString()} is due on ${payment.period_from}...`,
  unit_id: tenant.unit_id,
});

// Send SMS
if (tenant.phone) {
  await sendReminderSms(tenant.phone, tenantName, payment.amount, payment.period_from);
}
```

**Controllers:** [backend/src/controllers/payments.controller.ts](backend/src/controllers/payments.controller.ts#L390-L450)

---

### B. MAINTENANCE NOTIFICATIONS

**Triggered by:** Maintenance controller actions
**File:** [backend/src/controllers/maintenance.controller.ts](backend/src/controllers/maintenance.controller.ts)

**Notification Types:**

1. **`maintenance_request_created`**
   - Triggered: When tenant creates maintenance request
   - Recipients: Managers assigned to unit/apartment
   - In-app: ✓ Yes
   - SMS: ✗ No (only in-app)
   - Message: "{{TenantName}} submitted: {{Title}}"

2. **`maintenance_status_updated`**
   - Triggered: When manager updates maintenance status
   - Recipients: Tenant who submitted the request
   - In-app: ✓ Yes
   - SMS: ✗ No
   - Message: "Your request \"{{Title}}\" is now {{STATUS}}."

**Code Example:**
```typescript
// Maintenance creation
await createNotifications(
  (managers || []).map((manager: any) => ({
    apartmentowner_id,
    unit_id,
    recipient_role: "manager",
    recipient_id: manager.id,
    type: "maintenance_request_created",
    title: "New Maintenance Request",
    message: `${tenantName} submitted: ${title}`,
  }))
);
```

---

### C. ANNOUNCEMENT NOTIFICATIONS

**Triggered by:** Owner/Manager creates announcement
**File:** [backend/src/controllers/announcements.controller.ts](backend/src/controllers/announcements.controller.ts#L169-L195)

**Notification Type:**

1. **`announcement_created`**
   - Triggered: When announcement is posted
   - Recipients: Selected tenants (or all active tenants)
   - In-app: ✓ Yes
   - SMS: ✓ Yes (to all tenants with phone numbers)
   - Message: "{{AnnouncementTitle}}\n\n{{AnnouncementMessage}}"

**Code Example:**
```typescript
// Create in-app notifications
await createNotifications([...tenantNotifications, ...managerNotifications]);

// Send SMS to tenants
const tenantPhones = (tenants || []).map((t: any) => t.phone).filter(Boolean);
if (tenantPhones.length > 0) {
  const smsMessage = `${title}\n\n${message}`;
  sendSmsToMany(tenantPhones, smsMessage, { apartmentowner_id }).catch(
    (err) => console.error("Announcement SMS failed:", err)
  );
}
```

---

### D. TENANT LIFECYCLE NOTIFICATIONS

**File:** [backend/src/controllers/tenants.controller.ts](backend/src/controllers/tenants.controller.ts)

**Notification Types:**

1. **Account Creation** (when tenant is invited/created)
   - Email invitation with activation link
   - Uses Supabase Auth `inviteUserByEmail()`
   - Status changes: pending → pending_verification → active

2. **Account Approval** (owner approves tenant)
   - Email: Account activation confirmation
   - In-app notification
   - Approval email template: [Account Approved HTML](backend/src/utils/email.ts#L85+)

---

## 4. EMAIL CONFIGURATION

**File:** [backend/src/utils/email.ts](backend/src/utils/email.ts)

**Provider:** Gmail SMTP (via Nodemailer)

**Configuration:**
```typescript
// Environment Variables
SMTP_USER:    string  // Gmail address (required to enable email)
SMTP_PASS:    string  // Gmail app password (required to enable email)
```

**Email Types Sent:**

1. **Account Invitation** (Owner/Manager invitation)
   - Triggered: Manager/owner is invited
   - Contains: Activation link, role, next steps

2. **Account Approval**
   - Triggered: Owner approves pending tenant/manager
   - Contains: Confirmation, login instructions

3. **Maintenance Request Notification** (to managers)
   - Triggered: Tenant submits maintenance request
   - Contains: Request details, priority, description
   - Template function: `maintenanceRequestEmailHtml()`

4. **Password Reset**
   - Triggered: User requests password reset
   - Handled by Supabase Auth

**Email Implementation:**
```typescript
interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  // Checks if SMTP configured, creates transporter with Gmail
  // Handles batch recipients, error logging
}
```

---

## 5. NOTIFICATION ENDPOINTS & CONTROLLERS

**File:** [backend/src/routes/notifications.routes.ts](backend/src/routes/notifications.routes.ts)
**Controller:** [backend/src/controllers/notifications.controller.ts](backend/src/controllers/notifications.controller.ts)

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/notifications` | GET | Fetch notifications (filtered by role/ID/apartment) |
| `/api/notifications/:id/read` | PUT | Mark single notification as read |
| `/api/notifications/read-all` | PUT | Mark all notifications as read (requires role + ID) |
| `/api/notifications/:id` | DELETE | Delete single notification |
| `/api/notifications/all` | DELETE | Delete all notifications (requires role + ID) |
| `/api/notifications/test-sms` | POST | Send test SMS (admin testing) |
| `/api/notifications/sms-config` | GET | Check SMS configuration status |

### Test SMS Endpoint
```typescript
POST /api/notifications/test-sms
Body: { phone: string; message: string }
Response: { success: boolean; phone: string; message: "Test SMS sent" }
```

### SMS Config Status
```typescript
GET /api/notifications/sms-config
Response: {
  sms_enabled: boolean;
  semaphore_api_key_configured: boolean;
  semaphore_sender_name: string | null;
  semaphore_api_url: string;
}
```

---

## 6. NOTIFICATION SERVICE FUNCTIONS

**File:** [backend/src/utils/notifications.ts](backend/src/utils/notifications.ts)

**Core Functions:**

```typescript
interface NotificationPayload {
  apartmentowner_id: string;
  recipient_role: "manager" | "tenant";
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  apartment_id?: string | null;
  unit_id?: string | null;
}

// Create single notification
export async function createNotification(payload: NotificationPayload): Promise<void>

// Create batch notifications
export async function createNotifications(payloads: NotificationPayload[]): Promise<void>

// Automatically resolves apartment_id from unit_id or apartmentowner_id
```

**Context Resolution:**
- If `apartment_id` provided → use directly
- If `unit_id` provided → lookup unit's apartment_id
- If `apartmentowner_id` provided → get first apartment for owner
- Else → null (allowed, not all notifications need apartment context)

---

## 7. FRONTEND NOTIFICATION API

**File:** [frontend/src/lib/tenantApi.ts](frontend/src/lib/tenantApi.ts#L256-L313)

**Tenant Notification Functions:**

```typescript
// Fetch notifications
export async function getTenantNotifications(
  tenantId: string, 
  ownerId?: string | null
): Promise<TenantNotification[]>

// Mark single as read
export async function markTenantNotificationRead(id: string): Promise<void>

// Mark all as read
export async function markAllTenantNotificationsRead(tenantId: string): Promise<void>

// Delete single
export async function deleteTenantNotification(id: string): Promise<void>

// Delete all
export async function deleteAllTenantNotifications(tenantId: string): Promise<void>

// Get unread count
export async function getUnreadNotificationCount(tenantId: string): Promise<number>
```

**Frontend Notification Interface:**
```typescript
interface TenantNotification {
  id: string;
  apartmentowner_id: string | null;
  apartment_id: string | null;
  recipient_role: string;
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}
```

---

## 8. NOTIFICATION FLOW DIAGRAM

```
System Event
    ↓
├─ Payment Status Change
│  ├─ Create in-app notification
│  ├─ Log activity
│  └─ Send SMS (if phone available)
│
├─ Maintenance Update
│  ├─ Create in-app notification
│  └─ Log activity
│
├─ Announcement Posted
│  ├─ Create in-app notifications (multiple)
│  ├─ Send SMS batch (to selected/all tenants)
│  └─ Log activity
│
└─ Account Event
   ├─ Invite/Approve: Send email
   └─ Create in-app notification
```

---

## 9. KEY IMPLEMENTATION FILES

### Backend Core
- [SMS Utility](backend/src/utils/sms.ts) - SMS sending & logging
- [Notifications Utility](backend/src/utils/notifications.ts) - Notification creation
- [Email Utility](backend/src/utils/email.ts) - Email templates & sending
- [Billing Scheduler](backend/src/utils/billingScheduler.ts) - Auto payment reminders/overdue
- [Announcements Controller](backend/src/controllers/announcements.controller.ts) - Announcement + SMS
- [Maintenance Controller](backend/src/controllers/maintenance.controller.ts) - Maintenance notifications
- [Payments Controller](backend/src/controllers/payments.controller.ts) - Payment notifications
- [Tenants Controller](backend/src/controllers/tenants.controller.ts) - Tenant lifecycle
- [Notifications Controller](backend/src/controllers/notifications.controller.ts) - API endpoints

### Frontend
- [Tenant API](frontend/src/lib/tenantApi.ts) - Notification API wrapper
- [Owner API](frontend/src/lib/ownerApi.ts) - Owner/Manager notification endpoints

### Database Schemas
- [Schema Definition](frontend/supabase/schema.v6.sql#L247-L280)
- [Migration](frontend/supabase/migrations/20260410_v5_safe_sync.sql#L120-L150)

### Documentation
- [Notifications & SMS Feature Doc](backend/docs/features/notifications-sms.md)
- [System Architecture](frontend/docs/System%20Architecture.md#L33-L50)
- [Project Development Notes](frontend/docs/Project%20Dev.md#L25)
- [Flow Chart](docs/flowchart.md#L281-L300)

---

## 10. CURRENT LIMITATIONS & NOTES

1. **SMS Only in PH:** Phone numbers must be Philippine format (09XX or +639XX)
2. **SMS Truncation:** Messages > 160 chars are truncated with "..."
3. **SMS Context:** Only in-app notifications for tenant actions; SMS reserved for critical events
4. **Email on Demand:** Email requires SMTP configuration (Gmail); not auto-enabled
5. **No Real-time Push:** Notifications are stored in-app; polling required on frontend
6. **Billing Scheduler:** Runs hourly, checks payment dates 3 days before & after due date
7. **Duplicate Prevention:** Payment notifications checked via `notificationAlreadySent()` to prevent duplicates

---

## 11. TESTING ENDPOINTS

### Send Test SMS
```bash
curl -X POST http://localhost:5000/api/notifications/test-sms \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "phone": "09XXXXXXXXX", "message": "Test SMS" }'
```

### Check SMS Configuration
```bash
curl http://localhost:5000/api/notifications/sms-config \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### Fetch Notifications
```bash
curl "http://localhost:5000/api/notifications?recipient_id=<TENANT_ID>&recipient_role=tenant" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```
