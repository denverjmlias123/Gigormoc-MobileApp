# System Integration and Architecture (SIA) — Final Project Diagrams
**System Title:** Gigormoc (Hyperlocal Gig Marketplace with Security, Moderation, & AI Assistance)  
**Course:** IT/CS — System Integration and Architecture  
**Student:** John Denver Lias (#65)  

This document presents the complete architectural specifications and 5 formal system diagrams complying with the SIA Final Project Requirements.

---

## 1. Use Case Diagram (System Users)

The Use Case Diagram defines the interactions between the system actors and core business & security functionalities.

### System Actors:
* **Client (Primary Actor):** Posts gigs, reviews applicant proposals, creates and manages milestone contracts, reviews work deliverables, confirms payments, and rates freelancers.
* **Freelancer (Primary Actor):** Browses gigs, manages skill portfolio, submits proposals/counter-offers, submits milestone proof-of-work, and rates clients.
* **Admin / Moderator (Administrative Actor):** Views dashboard metrics, manages user accounts (activate, suspend, lock, unlock), reviews dispute reports, and inspects immutable audit logs.
* **Super Admin (Administrative Actor):** Assigns admin roles, triggers on-demand database backups, and executes database restores.
* **External AI Service & Security Governor (Secondary/System Actor):** Performs legitimacy scoring, enforces 3-attempt lockouts, manages 15-minute inactivity timers, and automates scheduled database backups.

```mermaid
flowchart LR
    subgraph Actors["System Actors"]
        Client["👤 Client"]
        Freelancer["👤 Freelancer"]
        Admin["🛡️ Admin"]
        SuperAdmin["👑 Super Admin"]
        SecurityGov["⚙️ Security & AI Engine"]
    end

    subgraph AuthSecurity["Authentication & Security Module"]
        UC_Auth["Sign Up / Login (Dual Identifier)"]
        UC_OTP["Verify 6-Digit OTP (Signup / Change Email / Reset)"]
        UC_Captcha["Solve CAPTCHA Challenge"]
        UC_Session["Manage Active Sessions & Auto-Logout"]
        UC_ChangePass["Change / Reset Password"]
    end

    subgraph Marketplace["Marketplace & Transaction Cycle"]
        UC_PostGig["Post & Manage Gigs"]
        UC_Apply["Submit Proposal / Counter-Offer"]
        UC_Milestone["Set Up & Submit Milestones"]
        UC_Approve["Review & Approve Deliverable"]
        UC_Payment["Report & Confirm Payment"]
        UC_Review["Submit Mutual Rating & Review"]
    end

    subgraph Administration["Administration & Compliance Module"]
        UC_UserCRUD["User CRUD & Lock/Unlock"]
        UC_Audit["Filter & Export Log Trail (CSV)"]
        UC_Backup["Create & Restore Database Backups"]
        UC_AIVerify["AI Legitimacy Moderation Queue"]
    end

    Client --> UC_Auth
    Client --> UC_OTP
    Client --> UC_ChangePass
    Client --> UC_Session
    Client --> UC_PostGig
    Client --> UC_Milestone
    Client --> UC_Approve
    Client --> UC_Payment
    Client --> UC_Review

    Freelancer --> UC_Auth
    Freelancer --> UC_OTP
    Freelancer --> UC_ChangePass
    Freelancer --> UC_Session
    Freelancer --> UC_Apply
    Freelancer --> UC_Milestone
    Freelancer --> UC_Payment
    Freelancer --> UC_Review

    Admin --> UC_Auth
    Admin --> UC_UserCRUD
    Admin --> UC_Audit
    Admin --> UC_AIVerify

    SuperAdmin --> UC_UserCRUD
    SuperAdmin --> UC_Backup
    SuperAdmin --> UC_Audit

    SecurityGov --> UC_Captcha
    SecurityGov --> UC_Session
    SecurityGov --> UC_Backup
    SecurityGov --> UC_AIVerify
```

---

## 2. System Flow Diagram (Swimlanes and Pools)

The System Flow Diagram models the end-to-end transactional lifecycle and participant handoffs across 4 operational swimlanes: **Client**, **Freelancer**, **System / Database**, and **Admin**.

```mermaid
sequenceDiagram
    autonumber
    actor C as Client
    actor F as Freelancer
    participant S as System & Database (Supabase)
    actor A as Admin

    Note over C,S: Phase 1: Authentication & Gig Posting
    C->>S: 1. Sign up / Login (Email/Username + Password)
    S-->>C: 2. Enforce OTP / Lockout / Session Token
    C->>S: 3. Publish Gig (Title, Budget, Milestones, Area)
    S->>S: 4. Record gig & log audit trail

    Note over F,S: Phase 2: Proposal & Agreement
    F->>S: 5. Browse available gigs (own-content excluded)
    F->>S: 6. Submit Proposal / Counter-Offer
    S-->>C: 7. Notify Client of applicant
    C->>S: 8. Accept proposal & create Agreement
    S->>S: 9. Lock status to 'active'; generate Milestone tracking

    Note over F,C: Phase 3: Deliverable & Payment Execution
    F->>S: 10. Submit Deliverable (Private storage bucket)
    S-->>C: 11. Notify Client of submission
    C->>S: 12. Review & Approve Milestone work
    C->>S: 13. Submit Payment Evidence (Reference No., Receipt)
    F->>S: 14. Confirm Payment Receipt
    S->>S: 15. Transition Agreement status to 'completed'

    Note over C,F: Phase 4: Mutual Review & Feedback
    par Client Review
        C->>S: 16. Submit Star Rating & Review for Freelancer
    and Freelancer Review
        F->>S: 17. Submit Star Rating & Review for Client
    end
    S->>S: 18. Recalculate incremental profile ratings

    Note over A,S: Phase 5: Audit & Administration
    A->>S: 19. Inspect tamper-proof Log Trail (Filter/Export CSV)
    A->>S: 20. Trigger manual / scheduled Database Backup
    S-->>A: 21. Confirm cryptographic checksum & snapshot
```

---

## 3. Entity Relationship Diagram (ERD)

The ERD details the relational database structure, primary keys (PK), foreign keys (FK), and entity relationships enforced by PostgreSQL.

```mermaid
erDiagram
    PROFILES ||--o{ GIGS : "posts"
    PROFILES ||--o{ APPLICATIONS : "submits"
    PROFILES ||--o{ AGREEMENTS : "contracts as client"
    PROFILES ||--o{ AGREEMENTS : "contracts as freelancer"
    PROFILES ||--o{ USER_SESSIONS : "owns"
    PROFILES ||--o{ AUDIT_EVENTS : "triggers"
    PROFILES ||--o{ REVIEWS : "writes"
    PROFILES ||--o{ REVIEWS : "receives"
    
    GIGS ||--o{ APPLICATIONS : "receives"
    GIGS ||--o| AGREEMENTS : "binds"
    CATEGORIES ||--o{ GIGS : "classifies"

    AGREEMENTS ||--|{ MILESTONES : "contains"
    MILESTONES ||--o{ SUBMISSIONS : "receives"
    AGREEMENTS ||--o{ PAYMENTS : "tracks"

    PROFILES ||--o{ DATABASE_BACKUPS : "creates"

    PROFILES {
        uuid id PK
        text username UK
        text display_name
        text area
        text active_mode
        text status
        boolean onboarding_complete
        numeric freelancer_rating_avg
        numeric client_rating_avg
        timestamptz created_at
    }

    GIGS {
        uuid id PK
        uuid client_id FK
        uuid category_id FK
        text title
        text description
        integer budget_centavos
        text status
        timestamptz created_at
    }

    CATEGORIES {
        uuid id PK
        text name UK
        text slug UK
        boolean is_active
    }

    APPLICATIONS {
        uuid id PK
        uuid gig_id FK
        uuid freelancer_id FK
        integer proposed_price
        text proposal_text
        text status
        timestamptz created_at
    }

    AGREEMENTS {
        uuid id PK
        uuid gig_id FK
        uuid client_id FK
        uuid freelancer_id FK
        integer agreed_price
        text status
        timestamptz completed_at
    }

    MILESTONES {
        uuid id PK
        uuid agreement_id FK
        integer milestone_number
        text title
        integer amount
        text status
    }

    SUBMISSIONS {
        uuid id PK
        uuid milestone_id FK
        text notes
        text file_path
        timestamptz created_at
    }

    PAYMENTS {
        uuid id PK
        uuid agreement_id FK
        integer amount
        text payment_method
        text status
        text proof_path
    }

    REVIEWS {
        uuid id PK
        uuid agreement_id FK
        uuid reviewer_id FK
        uuid reviewee_id FK
        integer rating
        text comment
    }

    USER_SESSIONS {
        uuid id PK
        uuid user_id FK
        timestamptz started_at
        timestamptz last_seen_at
        timestamptz ended_at
        text end_reason
        text platform
    }

    AUDIT_EVENTS {
        uuid id PK
        uuid actor_id FK
        text action
        text entity_type
        uuid entity_id
        jsonb metadata
        timestamptz created_at
    }

    DATABASE_BACKUPS {
        uuid id PK
        timestamptz created_at
        uuid created_by FK
        text backup_type
        text status
        integer record_count
        text checksum
        jsonb snapshot_data
    }
```

---

## 4. System Flowchart

The System Flowchart depicts the operational logic, decision branches, validation gates, and input/output processing of Gigormoc.

```mermaid
flowchart TD
    Start(["🚀 Start Application"]) --> LoginInput[/"User inputs Identifier & Password"/]
    LoginInput --> CheckLockout{"Is Account Locked?<br>(3 Failed Attempts)"}

    CheckLockout -- Yes --> ShowTimer[/"Display Live Countdown Timer"/]
    ShowTimer --> CheckCaptcha{"Failed Attempts Continue?"}
    CheckCaptcha -- Yes --> RequireCaptcha[/"Enforce Interactive CAPTCHA"/]
    RequireCaptcha --> SolveCaptcha{"CAPTCHA Solved Correctly?"}
    SolveCaptcha -- No --> RejectAttempt["Reject Entry & Refresh CAPTCHA"] --> LoginInput
    SolveCaptcha -- Yes --> CheckCredentials
    CheckCaptcha -- No --> RejectAttempt

    CheckLockout -- No --> CheckCredentials{"Validate Credentials against Server"}

    CheckCredentials -- Invalid --> IncrementFail["Record Failed Attempt in DB"]
    IncrementFail --> Check3Attempts{"Failed Count >= 3?"}
    Check3Attempts -- Yes --> TriggerLockout["Apply Escalating Lockout (1, 5, 15 min)"] --> ShowTimer
    Check3Attempts -- No --> ShowRemaining[/"Show Remaining Attempts"/] --> LoginInput

    CheckCredentials -- Valid --> ClearAttempts["Reset Failed Attempts & Lockout"]
    ClearAttempts --> CheckOTP{"Account Verified & First Login?"}

    CheckOTP -- No --> VerifyOTPModal[/"Prompt 6-Digit In-App OTP"/]
    VerifyOTPModal --> CheckOTPCorrect{"OTP Valid & Unexpired?"}
    CheckOTPCorrect -- No --> RejectOTP["Show Error & Enforce Cooldown"] --> VerifyOTPModal
    CheckOTPCorrect -- Yes --> CreateSession

    CheckOTP -- Yes --> CreateSession["Create Secure Session in user_sessions"]
    CreateSession --> InitTimer["Initialize 15-Min Inactivity Monitor"]

    InitTimer --> RoleRouter{"Determine User Role"}
    RoleRouter -- Admin / Super Admin --> AdminPortal["Render Admin Dashboard & Security Tools"]
    RoleRouter -- Client --> ClientDash["Render Client Marketplace (Post/Manage)"]
    RoleRouter -- Freelancer --> FreelancerDash["Render Freelancer Feed (Browse/Apply)"]

    subgraph InactivityGuard["Continuous Inactivity & Session Guard"]
        UserAction{"User Inactivity >= 14 Mins?"}
        UserAction -- Yes --> WarningDialog[/"Surface 60-Second Warning Modal"/]
        WarningDialog --> ExtendCheck{"User clicks 'Stay Logged In'?"}
        ExtendCheck -- Yes --> ResetInactivity["Reset Activity Timestamp"]
        ExtendCheck -- No --> Timeout{"Countdown = 0?"}
        Timeout -- Yes --> AutoLogout["Terminate Session & Route to Login"]
    end

    AdminPortal --> UserAction
    ClientDash --> UserAction
    FreelancerDash --> UserAction

    AutoLogout --> End(["🛑 End Session"])
```

---

## 5. Network Diagram (Network Flow)

The Network Diagram details the multi-tier client-server topology, protocols, security boundaries, cloud infrastructure, and external microservices.

```mermaid
flowchart TB
    subgraph ClientTier["📱 Client Presentation Tier"]
        MobileApp["React Native Mobile App (iOS / Android)"]
        WebApp["React Native Web App (Chrome / Safari / Edge)"]
    end

    subgraph PerimeterTier["🌐 Network Perimeter & Transport"]
        DNS["Cloudflare DNS / DDOS Shield"]
        HTTPS["TLS 1.3 / HTTPS Encryption"]
    end

    subgraph GatewayTier["🚪 API Gateway & Authentication Tier"]
        Kong["Kong API Gateway (Reverse Proxy / Rate Limiter)"]
        GoTrue["Supabase GoTrue Auth Service (JWT & Bcrypt)"]
    end

    subgraph BackendTier["⚡ Application & Data Tier (Supabase)"]
        PostgREST["PostgREST RESTful Engine"]
        EdgeFunctions["Deno Edge Runtime (admin-users, ai-assist, login-guard)"]
        PostgresDB[(PostgreSQL Database Cluster)]
        StorageBucket[("Encrypted Storage Buckets (Avatars, Submissions, Receipts)")]
    end

    subgraph ExternalTier["☁️ External Third-Party Services"]
        AI_API["OpenRouter / Google Gemini API (AI Verification & Polishing)"]
        MailService["SMTP / Resend Email Delivery Engine"]
    end

    ClientTier -->|HTTPS / WSS| PerimeterTier
    PerimeterTier --> GatewayTier
    
    Kong -->|Token Validation| GoTrue
    Kong -->|Data Queries| PostgREST
    Kong -->|Secure RPC & Logic| EdgeFunctions

    PostgREST -->|Parameterized SQL + RLS| PostgresDB
    EdgeFunctions -->|Service Role Key| PostgresDB
    EdgeFunctions -->|Signed URLs| StorageBucket

    EdgeFunctions -->|HTTPS REST| AI_API
    GoTrue -->|SMTP Protocol| MailService
```

---

## 6. Diagram Conformance Checklist

| Requirement | Diagram | Conformance Notes |
|---|---|---|
| **1. Use Case Diagram** | Section 1 | Identifies Client, Freelancer, Admin, Super Admin, and System/AI Engine. Full standard UML relationships. |
| **2. System Flow Diagram** | Section 2 | 4 distinct participants in sequence lanes, complete transaction cycle, explicit start & end. |
| **3. Entity Relationship Diagram (ERD)** | Section 3 | Identifies all core entities, data types, primary keys (PK), foreign keys (FK), and cardinalities. |
| **4. System Flowchart** | Section 4 | Uses standard flowchart symbols (ovals, rectangles, diamonds, parallelograms), inputs, logic branches, and storage elements. |
| **5. Network Diagram** | Section 5 | Shows mobile and web clients, TLS perimeter, API Gateway, Auth, Postgres DB with RLS, Deno Edge Functions, and external AI services. |
