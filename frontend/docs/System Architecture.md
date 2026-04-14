# PrimeLiving V3 — System Architecture

---

## 3.1.1 System Architecture

The System follows a **client–server architecture** with a clear separation between the presentation layer, the business logic layer, and the data persistence layer. This architecture was chosen for its suitability in supporting a web-based application accessible through both desktop and mobile browsers, while allowing each layer to be developed, tested, and scaled independently.

### User Layer

The System operates within a **multi-role user environment** comprising three distinct user types: **Apartment Owners**, **Apartment Managers**, and **Tenants**. Each user type interacts with the system through a dedicated role-specific dashboard that surfaces only the features and data relevant to their responsibilities. Apartment Owners manage property listings, assign managers, oversee rental collections, and review audit logs. Apartment Managers handle day-to-day operations such as tenant onboarding, maintenance request processing, and payment verification for the properties assigned to them. Tenants access their individual unit details, submit maintenance requests, view billing statements, and make rental payments.

### Frontend Layer (Client)

The client layer is built with **React 18** and **TypeScript**, bundled using **Vite** for fast development and optimized production builds. The user interface is styled with **Tailwind CSS** and enhanced with accessible, composable components from **Radix UI**. Form handling and validation are managed through **React Hook Form** paired with **Zod** schemas, ensuring that all user input — from sensitive personal profiles to financial records — is validated with strict type-checking before reaching the backend. Data visualization for analytics dashboards is rendered using **Recharts**, and in-app toast notifications are powered by **Sonner**.

Rather than relying on a third-party data-fetching library, the frontend implements a **custom API client** with built-in features such as automatic JWT token injection, response caching with configurable time-to-live, request deduplication for concurrent identical calls, and automatic cache invalidation when mutations occur. This ensures that any action taken on the dashboard is reflected promptly without requiring manual browser refreshes.

The frontend connects directly to the **PSGC API** (Philippine Standard Geographic Code) to populate cascading address dropdowns (Region → Province → City/Municipality → District → Barangay) when registering new properties. This provides an accurate and standardized Philippine address input experience without burdening the backend.

The application is deployed to **Vercel** for hosting, with continuous deployment triggered through **GitHub** version control. This ensures that every code change pushed to the repository is automatically built and published to the production environment.

### Backend Layer (Server)

The server layer is a **Node.js** application built with **Express 5** and **TypeScript**. It serves as the sole intermediary between the frontend and the database, implementing all business logic, data validation, and access control. The backend is hardened with security middleware including **Helmet** for HTTP header protection, **CORS** for cross-origin request control, **Compression** for response payload optimization, and **Morgan** for request logging and audit trails.

The backend contains three key service areas:

1. **Authentication Middleware** — Every incoming request is authenticated by verifying the JWT token issued by **Supabase Auth**. The middleware resolves the user's role (Owner, Manager, or Tenant) by cross-referencing the authenticated user ID against the profile tables in the database. Role-based authorization ensures that, for example, while an Apartment Manager can access payment histories of tenants under their supervision, a Tenant is restricted to viewing only their individual billing statements and unit details. This granular access control is essential for maintaining data privacy and operational security.

2. **Validation Service** — All input data from API requests is validated using **Zod** schemas on the server side, serving as a second line of defense beyond the frontend validation. Email addresses submitted during account creation are additionally verified against the **Abstract API** email validation service to detect disposable, invalid, or undeliverable addresses before they enter the system.

3. **Notification Service** — When an Apartment Owner or Manager triggers a notification — such as a tenant creation confirmation, a maintenance update, a payment confirmation, or an announcement — the backend processes the request and communicates with the **Semaphore SMS API** to deliver an SMS directly to the recipient's registered Philippine mobile number. This ensures that critical information reaches the user even when they are not actively logged into the web application. Additionally, **Supabase Email** is used to send account activation invitations, email verification links, owner invitations, and password reset emails automatically.

### Database and Storage Layer (Supabase)

All persistent data is stored in a **PostgreSQL** database hosted on **Supabase**. The database contains 14 tables organized around the core domain: `apartment_owners`, `apartment_managers`, `apartments`, `units`, `tenants`, `unit_occupants`, `maintenance`, `payments`, `revenues`, `documents`, `announcements`, `notifications`, `sms_logs`, and `apartment_logs`. **Row Level Security (RLS)** policies are enforced at the database level to provide an additional layer of access control beyond the backend authorization, ensuring that even direct database queries respect user role boundaries.

**Supabase Auth** manages the entire authentication lifecycle, including user registration via email invitation, secure login with JWT token issuance, session management, and password recovery. **Supabase Storage** provides secure file storage for uploaded assets such as tenant ID photos, payment receipts, and document attachments. Files are organized by user and linked to their unique identifiers, allowing for secure storage and easy retrieval whenever needed.

### External Services

| Service | Purpose | Integration Point |
|---------|---------|-------------------|
| **PSGC API** | Philippine geographic location data (regions, provinces, cities, barangays) | Frontend (AddressSelector component) |
| **Abstract API** | Email address validation and deliverability checking | Backend (account creation) |
| **Semaphore SMS** | SMS delivery to Philippine mobile numbers | Backend (notification service) |
| **Supabase Email** | Automated transactional emails (activation, verification, invites, password reset) | Backend (triggered via Supabase Auth) |
| **Supabase Auth** | JWT-based user authentication and session management | Frontend (login/session) + Backend (token verification) |
| **Supabase Storage** | Secure file storage for ID photos, receipts, and documents | Backend (file uploads/downloads) |
| **GitHub** | Version control and source code repository | CI/CD pipeline |
| **Vercel** | Frontend hosting and continuous deployment | Deployment target |

### Data Flow Summary

The interaction loop begins when a user accesses their role-specific dashboard through the React frontend, which is served from Vercel. Authentication is handled by Supabase Auth, which issues a JWT token upon successful login. Every subsequent API call from the frontend to the Express backend includes this token in the Authorization header. The backend's authentication middleware verifies the token, resolves the user's role, and enforces authorization policies before processing the request.

For data operations, the backend communicates with the PostgreSQL database through the Supabase client, using either the **admin client** (service_role key, bypasses RLS) for system-level operations such as user creation, or a **per-request client** (user's JWT, respects RLS) for user-scoped queries. This dual-client approach ensures both operational flexibility and security compliance.

The interaction loop is completed through the automated notification services: when a backend operation requires external communication — whether an SMS to a tenant's phone via Semaphore or a verification email via Supabase — the appropriate service is invoked asynchronously, ensuring that the user's request is not blocked by external service latency. This integrated flow ensures that every user action is validated, stored, and communicated efficiently across the entire technical stack.

---

## Technology Stack Summary

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Radix UI, React Hook Form, Zod, Recharts, React Router DOM, Sonner, date-fns, Lucide React |
| **Backend** | Node.js, Express 5, TypeScript, Helmet, CORS, Compression, Morgan, Zod, Supabase JS |
| **Database** | PostgreSQL (Supabase) with Row Level Security |
| **Authentication** | Supabase Auth (JWT) |
| **File Storage** | Supabase Storage |
| **Email** | Supabase Email (SMTP) |
| **SMS** | Semaphore API |
| **Email Validation** | Abstract API |
| **Location Data** | PSGC API (psgc.cloud) |
| **Hosting** | Vercel (frontend) |
| **Version Control** | GitHub |
| **Testing** | Vitest |

---

## System Architecture Diagram Explanation

The System Architecture Diagram illustrates the complete data and communication flow of the PrimeLiving Property Management System, organized into five distinct zones: Users, Frontend, Backend (Express API), External Services, and Supabase.

### Users (Left Panel)

On the far left, three user roles are represented: **Tenant**, **Apartment Owner**, and **Manager**. Each user accesses the system through the same web application but is directed to a role-specific dashboard upon login. The arrow labeled *"dashboard access"* indicates that all users interact with the system exclusively through the frontend layer — no user directly communicates with the backend or database.

### Frontend (Blue Box)

The Frontend zone contains the **React App + TypeScript** application, which houses three dedicated dashboards: the **Tenant Dashboard**, the **Apartment Owner Dashboard**, and the **Manager Dashboard**. These dashboards are rendered as single-page application views that dynamically load content based on the user's role and permissions. The React application is deployed to **Vercel Hosting**, which serves the built static assets to end users over HTTPS.

The connection between the Frontend and the Backend is represented by the *"REST API (HTTPS)"* arrow, indicating that all data operations (creating managers, submitting maintenance requests, processing payments, etc.) are handled through secure HTTP calls to the Express API. The frontend does not communicate directly with the database; instead, every request passes through the backend for authentication, authorization, and business logic processing.

### GitHub (Center, Dashed Lines)

**GitHub** sits between the Frontend and Backend as the central version control and collaboration hub. The dashed line labeled *"deployment"* shows that the frontend code is deployed from GitHub to Vercel through continuous deployment — every push to the repository triggers an automatic build and publish cycle. The dashed line labeled *"version control"* indicates that the backend source code is also managed in the same GitHub repository, ensuring that all code changes are tracked, reviewed, and versioned consistently.

### Backend — Express API (Green Box)

The Backend zone represents the **Express API** server built with Node.js and TypeScript. It contains three core service components:

1. **Validation Service** — Handles all input validation using Zod schemas and integrates with external services for email verification. It connects outward to the **PSGC API** (for Philippine location data) via the *"location data"* arrow, to **Abstract API** via the *"validate emails"* arrow, and to **Semaphore SMS** via the *"send SMS"* arrow.

2. **Notification Service** — Manages all automated communications. It connects to **Supabase Email** via the *"trigger emails"* arrow to send account activation invitations, email verification links, and password reset messages.

3. **Authentication Middleware** — Verifies every incoming JWT token by connecting to **Supabase Auth** via the *"user authentication"* arrow. It resolves user roles and enforces role-based access control before any request is processed.

The Backend also connects directly to **Supabase Storage** via the *"file storage"* arrow for uploading and retrieving files such as tenant ID photos, payment receipts, and document attachments. At the bottom, the *"read/write data"* arrow connects the Backend to the **PostgreSQL** database, where all persistent application data is stored and retrieved.

### External Services (Orange Box, Top Right)

The External Services zone groups three third-party APIs that the system depends on:

- **PSGC API (Location)** — Provides Philippine Standard Geographic Code data including regions, provinces, cities, municipalities, districts, and barangays. This is called from the frontend to populate cascading address selection dropdowns.
- **Abstract API (Email Validation)** — Validates email addresses during account creation to detect disposable, invalid, or undeliverable addresses before they enter the system.
- **Semaphore SMS** — Delivers SMS messages to Philippine mobile numbers for tenant notifications, maintenance updates, payment confirmations, and announcements.

### Supabase (Pink Box, Right Side)

The Supabase zone encompasses four managed services that form the backend-as-a-service infrastructure:

- **Supabase Email** — Handles automated transactional email delivery for account activation, email verification, owner invitations, and password resets, triggered by the Notification Service in the backend.
- **Supabase Auth** — Manages the complete authentication lifecycle including user registration, JWT token issuance, session management, and password recovery. It is accessed by both the frontend (for login and session persistence) and the backend (for token verification and user creation).
- **Supabase Storage** — Provides secure, organized file storage for all uploaded assets. Files are linked to user identifiers for access control and easy retrieval.
- **PostgreSQL** — The relational database at the foundation of the system, containing 14 tables with Row Level Security (RLS) policies that enforce data access boundaries at the database level.

### Payment Processing Note

The system handles payments through **manual payment modes** including Cash, GCash, Maya, and Bank Transfer. No third-party payment gateway is integrated — tenants record their payments in the system and upload proof of payment (receipts), which are then verified by the Apartment Manager or Owner through the dashboard.
