# E-AMS System Process Flow

> Electronic Apartment Management System with SMS-Based Notification and Automated Audit Reporting

---

## 1. Main System Flow

```mermaid
flowchart TD
    A([User opens the system]) --> B{Does an Owner\naccount exist?}

    B -->|No| C[Owner creates an account\nby entering name, email,\nphone number, and password]
    C --> D

    B -->|Yes| D[User is directed\nto the Login Page]
    D --> E[User enters their\nemail and password]
    E --> F{Are the\ncredentials valid?}
    F -->|No| G[System shows an\nerror message]
    G --> D

    F -->|Yes| H{What is the\naccount status?}
    H -->|Pending Verification| I[Access is denied\nuntil approved by\nthe Owner]
    I --> D

    H -->|Active| J{What role does\nthe user have?}
    J -->|Owner| K[User enters the\nOwner Dashboard]
    J -->|Manager| L[User enters the\nManager Dashboard]
    J -->|Tenant| M[User enters the\nTenant Dashboard]

    K --> N([User logs out\nand returns to Login])
    L --> N
    M --> N
    N --> D

    style K fill:#7C3AED,color:#fff
    style L fill:#2563EB,color:#fff
    style M fill:#059669,color:#fff
    style I fill:#DC2626,color:#fff
    style G fill:#DC2626,color:#fff
```

---

## 2. Owner Dashboard Process Flow

```mermaid
flowchart TD
    A([Owner opens\ntheir Dashboard]) --> B[User Management]
    A --> C[My Apartment]
    A --> D[Maintenance Requests]
    A --> E[Payment History]
    A --> F[Activity Logs]
    A --> G[Audit Report]
    A --> H[Account Settings]

    B --> B1[Owner adds a new Manager\nby entering name, email,\nand phone number]
    B1 --> B2[System assigns the Manager\nto an apartment and sends\nan email invitation]
    B2 --> B3[Manager account is set\nto Pending status]
    B --> B4[Owner views list of all\nManagers and their statuses]
    B --> B5[Owner reviews the Manager's\nID photos and approves\nor declines the account]

    C --> C1[Owner adds a new apartment\nbranch or location]
    C1 --> C2[Owner adds units or rooms\nunder the apartment]
    C2 --> C3[Owner configures each unit's\nrent amount, floor, and status]
    C --> C4[Owner assigns a Manager\nto handle the apartment]

    D --> D1[Owner views all maintenance\nrequests and their statuses]
    D1 --> D2[If a Manager has not acted,\nOwner can send an alert\nnotification]

    E --> E1[Owner views the monthly\nincome overview]
    E --> E2[Owner reviews payment records\nand can approve or reject\neach payment]
    E --> E3[Owner sets the payment\ninformation such as GCash,\nMaya, or bank details]
    E3 --> E4[These details are displayed\non the Tenant Dashboard]

    F --> F1[Owner views all system\nactivities and can filter\nby date, role, or type]

    G --> G1[Owner selects a time period\nor quarter to generate\na report]
    G1 --> G2[System shows revenue,\nexpenses, and net income]
    G2 --> G3[Owner can export\nthe report]

    H --> H1[Owner views their account\ninformation]
    H --> H2[Owner can change\ntheir password]

    style A fill:#7C3AED,color:#fff
    style B3 fill:#F59E0B,color:#000
```

---

## 3. Manager Dashboard Process Flow

```mermaid
flowchart TD
    A([Manager opens\ntheir Dashboard]) --> B[Manage Apartment]
    A --> C[Payment History]
    A --> D[Maintenance Requests]
    A --> E[Documents]
    A --> F[Notifications]
    A --> G[Account Settings]

    B --> B1[Manager adds a new Tenant\nby entering name, email,\nand phone number]
    B1 --> B2[System sends an email\ninvitation to the Tenant]
    B --> B3[Manager views all Tenant\nrecords and their statuses]
    B --> B4[Manager selects a vacant unit\nand assigns a Tenant to it\nwith rent and lease details]
    B --> B5[Manager creates an announcement\nwith a subject and message]
    B5 --> B6[Manager selects recipients:\nall tenants or specific ones]
    B6 --> B7[System sends SMS\nto the selected tenants]
    B --> B8[Manager views activity logs\nfor the apartment]

    C --> C1[Manager views and verifies\ndigital payment submissions\nby reviewing receipts]
    C1 --> C2{Does the receipt\nlook valid?}
    C2 -->|Yes| C3[Manager verifies\nthe payment]
    C2 -->|No| C4[Manager rejects the payment\nand Tenant must resubmit]
    C --> C5[Manager records a cash\npayment made in person\nby selecting the Tenant\nand entering the amount]

    D --> D1[Manager views all maintenance\nrequests and their details]
    D1 --> D2{What status\nupdate to make?}
    D2 -->|In Progress| D3[Status is set to In Progress\nand SMS is sent to Tenant]
    D2 -->|Resolved| D4[Status is set to Resolved\nand SMS is sent to Tenant]

    E --> E1[Manager uploads a document\nwith a description]
    E1 --> E2[Manager selects which\nTenant or Tenants\ncan access it]
    E2 --> E3[Document becomes available\nfor Tenants to download]

    F --> F1[Manager views notifications\nand can mark them as read\nor delete them]

    G --> G1[Manager views their\naccount details]
    G --> G2[Manager can change\ntheir password]

    style A fill:#2563EB,color:#fff
    style B7 fill:#059669,color:#fff
    style C3 fill:#059669,color:#fff
    style C4 fill:#DC2626,color:#fff
    style D3 fill:#3B82F6,color:#fff
    style D4 fill:#059669,color:#fff
```

---

## 4. Tenant Dashboard Process Flow

```mermaid
flowchart TD
    A([Tenant opens\ntheir Dashboard]) --> B[Overview]
    A --> C[Request Maintenance]
    A --> D[Payments]
    A --> E[Documents]
    A --> F[Notifications]
    A --> G[Account Settings]

    B --> B1[Tenant sees recent\nnotifications and alerts]
    B --> B2[Tenant sees recent\npayment history]
    B --> B3[Tenant sees their\ncontract progress]

    C --> C1[Tenant submits a new request\nby entering the title,\ndescription, and priority]
    C1 --> C2[Tenant uploads photos\nof the issue]
    C2 --> C3[Request is submitted\nwith Pending status]
    C3 --> C4[SMS is automatically sent\nto the Manager]
    C --> C5[Tenant can track the status\nof existing requests:\nPending, In Progress,\nor Resolved]

    D --> D1[Tenant views the payment\ninformation set by the Owner:\nGCash, Maya, or bank details]
    D --> D2[Tenant views their pending\nand overdue payments\nwith amounts and due dates]
    D --> D3[Tenant views their full\npayment history including\namount, date, and status]

    E --> E1[Tenant views documents\nassigned to them]
    E1 --> E2[Tenant can download\nany available document]

    F --> F1[Tenant views all\ntheir notifications]
    F1 --> F2[Tenant can mark\nnotifications as read\nor delete them]

    G --> G1[Tenant views and edits\ntheir account information]
    G --> G2[Tenant manages unit occupants\nby adding name, relationship,\ncontact, and uploading ID]
    G --> G3[Tenant can change\ntheir password]

    style A fill:#059669,color:#fff
    style C3 fill:#F59E0B,color:#000
    style C4 fill:#059669,color:#fff
```

---

## 5. User Onboarding Flow (Manager / Tenant)

```mermaid
flowchart TD
    A([Owner or Manager\nadds a new user]) --> B[System sends an email\ninvitation to the user]
    B --> C[Account status is set\nto Pending]

    C --> D{Does the user click\nthe invite link?}
    D -->|Link expired| E[Owner or Manager\nresends the invitation]
    E --> B

    D -->|Yes| F[User selects their ID type\nand uploads front and\nback photos of their ID]
    F --> G[User sets and confirms\ntheir password]
    G --> H[Account status changes to\nPending Verification]
    H --> I[A 60-second countdown\nappears before redirecting\nto the Login page]

    I --> J{Does the Owner or Manager\napprove the ID photos?}
    J -->|Approve| K[Account status is set\nto Active and user\ncan now log in]
    J -->|Decline| L[Account is declined\nand user cannot log in]

    style C fill:#F59E0B,color:#000
    style H fill:#F59E0B,color:#000
    style K fill:#059669,color:#fff
    style L fill:#DC2626,color:#fff
```

---

## 6. Payment Lifecycle Flow

```mermaid
flowchart TD
    A([Rent due date\napproaches]) --> B[Payment status is\nset to Pending]

    B --> C{Has the grace\nperiod passed?}
    C -->|Yes| D[Status changes\nto Overdue]
    D --> E
    C -->|No| E{How does the\nTenant pay?}

    E -->|Digital: GCash,\nMaya, or Bank| F[Tenant uploads a\nreceipt image]
    E -->|Cash: In Person| G[Manager records\nthe cash payment]

    F --> H[Status changes to\nPending Verification]
    H --> I[SMS notification is\nsent to the Manager]
    I --> J{Does the Manager\nverify the receipt?}
    J -->|Yes| K[Status changes\nto Verified]
    J -->|No| L[Payment is rejected\nand Tenant must resubmit]
    L --> E

    G --> K

    K --> M{Does the Owner\napprove the payment?}
    M -->|Yes| N[Status changes\nto Approved]
    M -->|No| O[Payment is rejected\nand Tenant must resubmit]
    O --> E

    N --> P[SMS and notification\nis sent to the Tenant]
    N --> Q[Payment is recorded\nin the history]

    style B fill:#6B7280,color:#fff
    style D fill:#DC2626,color:#fff
    style H fill:#F59E0B,color:#000
    style K fill:#3B82F6,color:#fff
    style N fill:#059669,color:#fff
    style L fill:#DC2626,color:#fff
    style O fill:#DC2626,color:#fff
```

---

## 7. Maintenance Request Lifecycle Flow

```mermaid
flowchart TD
    A([Tenant submits a\nmaintenance request]) --> B[Tenant fills in the title,\ndescription, and priority level]
    B --> C[Tenant attaches photos\nof the issue, up to 4 images]
    C --> D[Request is created\nwith Pending status]

    D --> E[SMS is sent to the\nassigned Manager and Owner]
    E --> F{What does the\nManager do?}

    F -->|Set to In Progress| G[Status changes to In Progress\nand SMS is sent to Tenant]
    G --> H{Does the Manager\nresolve it?}
    H -->|Yes| I[Status changes to Resolved\nand SMS is sent to Tenant]

    F -->|Set to Resolved| I
    I --> J[The request is\nnow closed]

    style D fill:#F59E0B,color:#000
    style G fill:#3B82F6,color:#fff
    style I fill:#059669,color:#fff
    style J fill:#6B7280,color:#fff
```

---

## 8. Notification & SMS Flow

```mermaid
flowchart TD
    A([A system event\nis triggered]) --> B{What type\nof event?}

    B -->|Account Invitation| C[Email with activation\nlink is sent]
    B -->|Account Approved| D[Email confirming\napproval is sent]
    B -->|Password Reset| E[Email with reset\nlink is sent]

    B -->|Payment Submitted| F[SMS is sent\nto the Manager]
    B -->|Payment Verified| G[SMS is sent\nto the Owner]
    B -->|Payment Approved| H[SMS is sent\nto the Tenant]
    B -->|Payment Overdue| I[SMS is sent\nto the Tenant]

    B -->|Maintenance Created| J[SMS is sent to\nthe Manager and Owner]
    B -->|Maintenance Updated| K[SMS is sent\nto the Tenant]

    B -->|Announcement Posted| L[SMS is sent to\nthe selected Tenants]

    C & D & E & F & G & H & I & J & K & L --> M[An in-app notification\nis also created]
    M --> N[Notification appears in\nthe user's inbox with\nan unread badge]
    N --> O[User can mark as\nread or delete]

    style C fill:#3B82F6,color:#fff
    style D fill:#3B82F6,color:#fff
    style E fill:#3B82F6,color:#fff
    style I fill:#DC2626,color:#fff
```
