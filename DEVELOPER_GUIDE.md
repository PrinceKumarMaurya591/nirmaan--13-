# 🏗️ Thikedar App - Full Developer Documentation

Welcome to the **Thikedar App Developer Documentation**. This guide provides a highly structured, comprehensive, and easy-to-understand breakdown of the entire application. Whether you are onboarding a new developer or looking to add new features, this document will serve as your ultimate reference point.

---

## 📑 Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Directory Structure](#2-directory-structure)
3. [Core Workflows & Business Logic](#3-core-workflows--business-logic)
4. [Role-Based Access Control (RBAC)](#4-role-based-access-control-rbac)
5. [State Management (`store.tsx`)](#5-state-management-storetsx)
6. [Database Schema (`schema.ts`)](#6-database-schema-schemats)
7. [Backend API (`server.ts`)](#7-backend-api-serverts)
8. [Offline-First & Sync Mechanism](#8-offline-first--sync-mechanism)
9. [Step-by-Step: Adding a New Feature](#9-step-by-step-adding-a-new-feature)
10. [Troubleshooting & Debugging](#10-troubleshooting--debugging)

---

## 1. Architecture Overview

The Thikedar app is a modern, offline-first, full-stack web application designed for construction site management.

- **Frontend:** React 18, TypeScript, Tailwind CSS, Vite.
- **Backend:** Node.js, Express.js.
- **Database:** PostgreSQL.
- **ORM:** Drizzle ORM.
- **Authentication:** JWT (JSON Web Tokens) with Phone & PIN based login.
- **Architecture Pattern:** Single-page application (SPA) with a monolithic Express backend served via Vite middleware during development and as static files in production.

---

## 2. Directory Structure

Understanding where things live is the first step to mastering this codebase.

```text
/ 
├── server.ts                 # Main Backend Entry Point (Express server & APIs)
├── package.json              # Project dependencies and build scripts
├── src/                      # Frontend Source Code
│   ├── main.tsx              # React Entry Point
│   ├── App.tsx               # Main Component & View Router
│   ├── store.tsx             # Global State Management (React Context) & API Calls
│   ├── types.ts              # TypeScript Interfaces & Enums
│   ├── db/
│   │   └── schema.ts         # Database Table Definitions (Drizzle ORM)
│   └── components/           # UI Components
│       ├── Layout.tsx        # Desktop wrapper layout
│       ├── MobileLayout.tsx  # Mobile/Munshi wrapper layout
│       ├── MunshiEntry.tsx   # Field entry form (Material, Labor, Petty Cash)
│       ├── ProjectView.tsx   # Main ledger and project financial dashboard
│       ├── AdminDashboard.tsx# Portfolio overview for Admins
│       └── ...               # Other specialized views
```

---

## 3. Core Workflows & Business Logic

### A. The "Approval" Workflow (Data Flow)
To prevent incorrect entries from messing up the financial ledgers, the app uses a strict approval mechanism.
1. **Entry Creation:** A field worker (Munshi) submits an entry (e.g., received cement) via `MunshiEntry.tsx`.
2. **Pending State:** The frontend sends this to `/api/expenses`. The backend saves it in the `expense_items` table with `status = 'Pending Approval'`.
3. **Approval Queue:** Office Staff or Admins see this entry in `ApprovalDashboard.tsx`.
4. **Action:** The Admin clicks "Approve". An API call is made to `/api/approvals/:id/approve`.
5. **Ledger Update:** The backend updates the status to `Approved`. The frontend state updates, and the expense is now permanently visible in the project's ledger (`ProjectView.tsx`).

### B. Multi-Tenancy (Tenant ID)
The database is designed to handle multiple independent companies securely. 
- Almost every table has a `tenant_id` column.
- When a user logs in, their JWT token contains their `tenantId`.
- **CRITICAL:** Every backend API route strictly filters data by `tenant_id` (e.g., `where(eq(projects.tenantId, req.user.tenantId))`) to ensure data isolation between different companies.

---

## 4. Role-Based Access Control (RBAC)

The app's UI and API endpoints adapt based on the user's role.

| Role | Scope & Permissions | UI Layout |
|------|---------------------|-----------|
| **Super Admin** | Full access. Can create/delete users, projects, approve entries, view all financials. | Desktop (`Layout.tsx`) |
| **Admin** | Similar to Super Admin, manages day-to-day operations and approvals. | Desktop (`Layout.tsx`) |
| **Office Staff** | Can view ledgers, add vendors/subcontractors, and manage payments. Cannot approve field entries or manage users. | Desktop (`Layout.tsx`) |
| **Site Incharge** | Senior field staff. Can view assigned projects and manage entries. | Mobile (`MobileLayout.tsx`) |
| **Munshi** | Field worker. Can only make entries (Material, Labor, Petty Cash) for assigned projects. Cannot view total project financials. | Mobile (`MobileLayout.tsx`) |

*Role enforcement happens in `App.tsx` (Routing), `store.tsx` (State), and `server.ts` (API validation).*

---

## 5. State Management (`store.tsx`)

`store.tsx` is the **Heart of the Frontend**. It uses the React Context API to provide global state.

- **`initialState`**: Defines the default shape of the data (users, projects, current view).
- **`apiFetch` Wrapper**: A custom wrapper around the native `fetch` API. It automatically attaches the JWT token and handles offline queuing.
- **Mutations (e.g., `addExpense`, `updateProject`)**: These functions do two things:
  1. **Optimistic UI Update**: They immediately update the React state so the UI feels instant.
  2. **API Call**: They trigger the actual backend request to save the data permanently.

*Rule of Thumb: If data on the screen is not updating, check the corresponding mutation function in `store.tsx`.*

---

## 6. Database Schema (`schema.ts`)

Located in `src/db/schema.ts`, using Drizzle ORM for type safety.

- **`users`**: Stores user credentials, roles, and assigned project IDs (stored as JSON arrays).
- **`projects`**: Stores construction sites, total budgets (`woValue`), and received amounts.
- **`expense_items`**: The most active table. Stores materials, labor logs, and petty cash entries. Crucially relies on the `status` column.
- **`vendor_ledger` & `subcontractors`**: Tracks external parties, their total billing, and payments.
- **`site_advances`**: Tracks money sent from the office to the site/munshi.
- **`recycle_bin_items`**: Soft-delete mechanism. Instead of dropping rows, deleted data is serialized into JSON and stored here for potential restoration.

---

## 7. Backend API (`server.ts`)

The Express server handles all business logic and database interactions.

- **Authentication Middleware**: Extracts the JWT from the `Authorization` header and populates `req.user`.
- **API Routes Architecture**:
  - `/api/auth/*`: Login and token generation.
  - `/api/data`: The master endpoint that fetches all initial state (projects, users, expenses) for the logged-in user upon app load.
  - `/api/projects/*`: CRUD operations for projects.
  - `/api/expenses/*`: Submitting and managing field entries.
  - `/api/approvals/*`: Specialized routes for Admin approval workflows.
- **Vite Integration**: In development mode (`NODE_ENV !== 'production'`), Vite is mounted as middleware to serve the React frontend alongside the APIs.

---

## 8. Offline-First & Sync Mechanism

Construction sites often lack internet access. The app is built to never block the user.

1. **Detection**: If `apiFetch` in `store.tsx` fails due to a network error, it catches the error.
2. **Queueing**: The failed request (URL, method, payload) is saved to the browser's `localStorage` under the key `thikedar_sync_queue`.
3. **UI State**: The app displays an "Offline/Syncing..." indicator. The user can continue making entries.
4. **Reconnection**: A `setInterval` loop periodically checks connectivity. When online, the `syncOfflineAction` function processes the queue sequentially, pushing all saved data to the backend without user intervention.

---

## 9. Step-by-Step: Adding a New Feature

Follow this exact flow when adding a new capability to the app to avoid breaking the architecture.

**Step 1: Database (Backend)**
- Open `src/db/schema.ts`.
- Add your new table or add a column to an existing table.
- *(Note: Ensure you include a `tenantId` column if creating a new table).*

**Step 2: API Route (Backend)**
- Open `server.ts`.
- Create a new Express route (e.g., `app.post('/api/new-feature', ...)`).
- Write the Drizzle query to interact with the database.
- Return the response (`res.json(...)`).

**Step 3: Types & Context (Frontend)**
- Open `src/types.ts` and update interfaces to match your new database schema.
- Open `src/store.tsx`.
- Add a new state variable if necessary.
- Write a mutation function (e.g., `addNewFeatureData`) that calls your new API using `apiFetch` and updates the React state.

**Step 4: UI Component (Frontend)**
- Create or edit a component in `src/components/`.
- Import `useAppContext()`.
- Read the data from `state` and trigger your mutation functions on user interaction (e.g., `onClick`).

---

## 10. Troubleshooting & Debugging

- **Blank Screen on Load:**
  - *Cause*: A React component is trying to read a property of `undefined` before data has loaded.
  - *Fix*: Check the Console (F12). Add safe navigation (`?.`) or fallback checks (`if (!data) return null;`) in your UI components.
- **Data Not Saving / Disappearing on Refresh:**
  - *Cause*: The optimistic UI update in `store.tsx` worked, but the API call failed (or wasn't written).
  - *Fix*: Check the Network Tab in DevTools. Ensure the API route returns a `200 OK` status and the payload matches backend expectations.
- **Build Fails (`npm run build`):**
  - *Cause*: Usually strict TypeScript errors or malformed JSX syntax (e.g., an unmatched `</div>` or trailing `{}`).
  - *Fix*: Read the terminal error output carefully. It points directly to the file and line number causing the issue.
- **Port 3000 In Use:**
  - *Cause*: The container environment strictly requires the server to run on port 3000.
  - *Fix*: Ensure `server.ts` always binds to `0.0.0.0:3000`. Do not change this.

---
*End of Documentation. Maintain clean code, respect the offline-sync queue, and always filter backend queries by `tenantId`.*
