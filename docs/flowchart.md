# E-AMS System Flowchart

> Enhanced Apartment Management System with SMS-Based Notification and Automated Audit Reporting

---

## Main System Flow

```mermaid
flowchart TD
    START([System Access]) --> CHECK{Owner Account Exists?}

    CHECK -->|No| SETUP[/One-Time Owner Setup/]
    CHECK -->|Yes| LOGIN[/Login Page/]

    SETUP --> SETUP_FORM[Enter Personal Info, Email, Phone, Password]
    SETUP_FORM --> CREATE_OWNER[Create Owner Account]
    CREATE_OWNER --> LOGIN

    LOGIN --> AUTH{Valid Credentials?}
    AUTH -->|No| ERR[Display Error Message]
    ERR --> LOGIN
    AUTH -->|Yes| STATUS{Account Status?}
    STATUS -->|Pending Verification| BLOCK[Access Denied — Under Review]
    BLOCK --> LOGIN
    STATUS -->|Active| ROLE{User Role?}

    ROLE -->|Owner| OWNER_DASH[Owner Dashboard]
    ROLE -->|Manager| MGR_DASH[Manager Dashboard]
    ROLE -->|Tenant| TENANT_DASH[Tenant Dashboard]

    %% Owner Dashboard Modules
    OWNER_DASH --> OD_OVERVIEW[View Overview Metrics & Activity History]
    OWNER_DASH --> OD_APT[Manage Apartments & Units]
    OWNER_DASH --> OD_USERS[Manage Managers & Tenants]
    OWNER_DASH --> OD_PAY[Payment Management]
    OWNER_DASH --> OD_MAINT[Monitor Maintenance Requests]
    OWNER_DASH --> OD_ANN[Post Announcements]
    OWNER_DASH --> OD_DOCS[Manage Documents]
    OWNER_DASH --> OD_LOGS[View Activity Logs]
    OWNER_DASH --> OD_AUDIT[Generate Audit Reports]
    OWNER_DASH --> OD_ACCT[Account Settings]

    %% Manager Dashboard Modules
    MGR_DASH --> MD_OVERVIEW[View Overview Metrics]
    MGR_DASH --> MD_TENANTS[Manage Tenants]
    MGR_DASH --> MD_PAY[Record & Verify Payments]
    MGR_DASH --> MD_MAINT[Update Maintenance Statuses]
    MGR_DASH --> MD_ANN[Post Announcements with SMS]
    MGR_DASH --> MD_DOCS[Upload & Assign Documents]
    MGR_DASH --> MD_ACCT[Account Settings]

    %% Tenant Dashboard Modules
    TENANT_DASH --> TD_OVERVIEW[View Unit & Lease Details]
    TENANT_DASH --> TD_PAY[Submit Payment Proof]
    TENANT_DASH --> TD_MAINT[Submit Maintenance Request]
    TENANT_DASH --> TD_DOCS[View & Download Documents]
    TENANT_DASH --> TD_NOTIF[View Notifications]
    TENANT_DASH --> TD_ACCT[Account Settings & Occupants]

    %% Logout
    OWNER_DASH --> LOGOUT([Logout])
    MGR_DASH --> LOGOUT
    TENANT_DASH --> LOGOUT
    LOGOUT --> LOGIN
```

---

## User Onboarding Flow (Manager / Tenant)

```mermaid
flowchart TD
    ADD([Owner or Manager Adds User]) --> SEND[System Sends Invitation Email]
    SEND --> INVITE_STATUS["Account Status: Pending"]

    INVITE_STATUS --> CLICK{User Clicks Invite Link?}
    CLICK -->|No — Link Expires| RESEND[Resend Invitation]
    RESEND --> SEND
    CLICK -->|Yes| STEP1[Step 1: Select ID Type]

    STEP1 --> STEP1A["Upload Front ID Photo"]
    STEP1A --> STEP1B["Upload Back ID Photo"]
    STEP1B --> STEP2[Step 2: Set Password]
    STEP2 --> CONFIRM[Confirm Password & Verify Token]
    CONFIRM --> COMPLETE["Account Status: Pending Verification"]
    COMPLETE --> COUNTDOWN[60-Second Countdown → Login]

    COUNTDOWN --> OWNER_REVIEW{Owner / Manager Reviews ID Photos}
    OWNER_REVIEW -->|Approve| APPROVED["Account Status: Active ✓"]
    OWNER_REVIEW -->|Decline| DECLINED["Account Declined ✗"]

    APPROVED --> USER_LOGIN([User Can Now Login])

    style APPROVED fill:#059669,color:#fff
    style DECLINED fill:#DC2626,color:#fff
    style INVITE_STATUS fill:#F59E0B,color:#000
    style COMPLETE fill:#F59E0B,color:#000
```

---

## Payment Lifecycle Flow (Two-Step Verification)

```mermaid
flowchart TD
    BILLING([Monthly Billing Generated]) --> PENDING["Status: Pending"]

    PENDING --> DUE{Past Due Date + 3 Days?}
    DUE -->|Yes| OVERDUE["Status: Overdue"]
    OVERDUE --> SUBMIT
    DUE -->|No| SUBMIT

    SUBMIT{Payment Method?}
    SUBMIT -->|"Digital (GCash / Maya / Bank)"| TENANT_UPLOAD["Tenant Uploads Receipt Image"]
    SUBMIT -->|"Cash (In-Person)"| MGR_RECORD["Manager Records Cash Payment"]

    TENANT_UPLOAD --> PENDING_VERIF["Status: Pending Verification"]
    PENDING_VERIF --> NOTIF_MGR["SMS Notification → Manager"]

    MGR_RECORD --> VERIFIED_CASH["Status: Verified"]
    VERIFIED_CASH --> OWNER_APPROVE

    NOTIF_MGR --> MGR_REVIEW{Manager Reviews Receipt}
    MGR_REVIEW -->|Verify| VERIFIED["Status: Verified"]
    MGR_REVIEW -->|Reject| REJECTED["Status: Pending (Resubmit)"]
    REJECTED --> SUBMIT

    VERIFIED --> OWNER_APPROVE{Owner Reviews Payment}
    OWNER_APPROVE -->|Approve| APPROVED["Status: Approved → Paid ✓"]
    OWNER_APPROVE -->|Reject| REJECTED2["Status: Pending (Resubmit)"]
    REJECTED2 --> SUBMIT

    APPROVED --> NOTIF_TENANT["SMS & Email Notification → Tenant"]
    APPROVED --> RECORD["Payment Recorded in History"]

    style PENDING fill:#6B7280,color:#fff
    style OVERDUE fill:#DC2626,color:#fff
    style PENDING_VERIF fill:#F59E0B,color:#000
    style VERIFIED fill:#3B82F6,color:#fff
    style VERIFIED_CASH fill:#3B82F6,color:#fff
    style APPROVED fill:#059669,color:#fff
    style REJECTED fill:#DC2626,color:#fff
    style REJECTED2 fill:#DC2626,color:#fff
```

---

## Maintenance Request Lifecycle Flow

```mermaid
flowchart TD
    TENANT([Tenant Submits Request]) --> FORM["Fill Title, Description, Priority Level"]
    FORM --> PHOTOS["Attach Photos (Up to 4 Images)"]
    PHOTOS --> SUBMIT["Request Created"]
    SUBMIT --> PENDING["Status: Pending"]

    PENDING --> NOTIF["SMS & Email → Manager and Owner"]
    NOTIF --> MGR_UPDATE{Manager / Owner Updates Status}

    MGR_UPDATE -->|In Progress| IN_PROGRESS["Status: In Progress"]
    IN_PROGRESS --> NOTIF_TENANT1["SMS → Tenant"]
    NOTIF_TENANT1 --> MGR_UPDATE2{Further Update?}
    MGR_UPDATE2 -->|Resolved| RESOLVED["Status: Resolved"]

    MGR_UPDATE -->|Resolved| RESOLVED

    RESOLVED --> NOTIF_TENANT2["SMS → Tenant"]
    NOTIF_TENANT2 --> REVIEW{Tenant Submits Review?}
    REVIEW -->|Yes| RATING["Star Rating (1–5) + Comment"]
    REVIEW -->|No| CLOSED["Status: Closed"]
    RATING --> CLOSED

    style PENDING fill:#F59E0B,color:#000
    style IN_PROGRESS fill:#3B82F6,color:#fff
    style RESOLVED fill:#059669,color:#fff
    style CLOSED fill:#6B7280,color:#fff
```

---

## Notification System Flow

```mermaid
flowchart TD
    EVENT([System Event Triggered]) --> TYPE{Event Type?}

    TYPE -->|Account Invitation| EMAIL_INVITE["📧 Email: Activation Link"]
    TYPE -->|Account Approval| EMAIL_APPROVE["📧 Email: Account Approved"]
    TYPE -->|Password Reset| EMAIL_RESET["📧 Email: Reset Link"]

    TYPE -->|Payment Submitted| SMS_PAY_MGR["📱 SMS → Manager"]
    TYPE -->|Payment Verified| SMS_PAY_OWNER["📱 SMS → Owner"]
    TYPE -->|Payment Approved| SMS_PAY_TENANT["📱 SMS → Tenant"]
    TYPE -->|Payment Overdue| SMS_OVERDUE["📱 SMS → Tenant"]

    TYPE -->|Maintenance Submitted| SMS_MAINT["📱 SMS → Manager & Owner"]
    TYPE -->|Maintenance Updated| SMS_MAINT_T["📱 SMS → Tenant"]

    TYPE -->|Announcement Posted| SMS_ANN["📱 SMS → Selected Tenants"]

    EMAIL_INVITE --> INAPP["🔔 In-App Notification"]
    EMAIL_APPROVE --> INAPP
    SMS_PAY_MGR --> INAPP
    SMS_PAY_OWNER --> INAPP
    SMS_PAY_TENANT --> INAPP
    SMS_OVERDUE --> INAPP
    SMS_MAINT --> INAPP
    SMS_MAINT_T --> INAPP
    SMS_ANN --> INAPP

    INAPP --> INBOX["Notification Inbox with Unread Badge"]
    INBOX --> ACTIONS["Mark as Read / Delete"]

    style EMAIL_INVITE fill:#3B82F6,color:#fff
    style EMAIL_APPROVE fill:#3B82F6,color:#fff
    style EMAIL_RESET fill:#3B82F6,color:#fff
    style SMS_PAY_MGR fill:#059669,color:#fff
    style SMS_PAY_OWNER fill:#059669,color:#fff
    style SMS_PAY_TENANT fill:#059669,color:#fff
    style SMS_OVERDUE fill:#DC2626,color:#fff
    style SMS_MAINT fill:#059669,color:#fff
    style SMS_MAINT_T fill:#059669,color:#fff
    style SMS_ANN fill:#059669,color:#fff
```
