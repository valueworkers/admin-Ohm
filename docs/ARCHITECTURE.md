# Senior Care Admin — Architecture & Structure

This document describes the **current** multi-tenant admin panel: roles, data flow, folder layout, routes, and how UI/state fit together.

Related quick-start: [`README.md`](../README.md)  
Cursor product rules: [`.cursor/rules/`](../.cursor/rules/)

---

## 1. Purpose

Ops admin for a **senior-care multi-tenant platform**:

| Actor | Responsibility |
|---|---|
| **SUPER_ADMIN** | Only role that can sign in. Onboard / offboard tenants, approve Lobby, set permissions, inspect tenant data **read-only** |
| **TENANT_OWNER** | Contact/owner records only — **cannot sign in** to this panel |

There is **no live care API** in this build. Auth and domain data are **dummy** (seed + `localStorage`) so the product can be demoed and UI can evolve without a backend.

Shell UX is inspired by [FoodValve Admin](https://admin.foodvalve.com/dashboard) (dark sidebar, dense tables) with this project’s **sky + slate** design system (`.cursor/rules/uiux-rules.mdc`).

---

## 2. High-level architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  Browser (Vite + React 19)                                  │
│                                                             │
│  Routes / Guards                                            │
│    ProtectedRoute → Layout → RequireSuperAdmin              │
│      Lobby, Tenants, TenantDetail, Permissions, Insights…   │
│                                                             │
│  UI layer                                                   │
│    pages/ · components/ · EntityCrudPage · ui/*             │
│                                                             │
│  Access                                                     │
│    auth.js (session) · useAccess()                          │
│                                                             │
│  Domain store (single source of truth)                      │
│    data/seed.js  →  store/platformStore.js  → localStorage  │
│                         ↑ subscribePlatform()               │
└─────────────────────────────────────────────────────────────┘
```

**Principles**

1. **Super Admin only login** — tenant owner credentials are rejected at login.
2. **Read-only ops inspection** — Super Admin never gets write UI on tenant catalog/ops.
3. **One store** — `platformStore` owns users, tenants, and all collections; pages subscribe via hooks.
4. **Shared module defs** — inspection tabs reuse `EntityCrudPage` + `config/modules.jsx`.
5. **Design system** — buttons/fields from `utils/ui.js`; overlays from `components/ui/`.

---

## 3. Tenant lifecycle

```text
  Super Admin: Onboard tenant
           │
           ▼
     status = pending  ──────►  Lobby
           │
           │  Approve
           ▼
     status = active   ──────►  Tenants tab (inspect + permissions)
           │
           │  Offboard / Reject
           ▼
     status = offboarded
```

| Status | Where it appears | Panel login |
|---|---|---|
| `pending` | Lobby | Super Admin only |
| `active` | Tenants list | Super Admin only |
| `offboarded` | Offboarded list | Super Admin only |

Onboard may create a **TENANT_OWNER** contact user for the Owners directory; that account **cannot** sign in.

---

## 4. Auth & session

| Concern | Location |
|---|---|
| Roles / session helpers | `src/utils/auth.js` |
| Credential check | `findUserByCredentials` in `platformStore` |
| Login UI + demo chips | `src/pages/Login.jsx` |
| Access hook | `src/hooks/useAccess.js` |

**Login**

- Only `SUPER_ADMIN` may obtain a session (`canAccessAdminPanel` / `loginWithDummy`).
- `TENANT_OWNER` credentials return an explicit rejection message.
- Session in `localStorage` key `authUser` (no JWT).
- `canWriteTenantData` remains false for Super Admin (read-only ops inspection).

Reset: Login screen → **Reset demo data** → `resetPlatformStore()`.

---

## 5. Data model & store

### 5.1 Persistence

| Item | Value |
|---|---|
| Storage key | `sc_platform_v2` |
| Seed source | `src/data/seed.js` |
| Store API | `src/store/platformStore.js` |
| Change event | `platform-changed` (+ `storage` for cross-tab) |

### 5.2 Collections

| Collection | Description |
|---|---|
| `users` | Login accounts (`email`, `password`, `user_type`, `tenant_id`) |
| `tenants` | Orgs (`status`, owner contact, city, …) |
| `services` | Care services |
| `venues` | Clinics / venues |
| `packages` | Bundled packages |
| `vendors` | Suppliers |
| `vendorPayments` | Payments to vendors |
| `bookings` | Orders / bookings |
| `patients` | Patient profiles |
| `employees` | Staff |

Ops rows include `id` + `tenantId`.

### 5.3 Store API (selected)

| Function | Use |
|---|---|
| `getPlatformState` / `listCollection` / `listByTenant` | Reads |
| `upsertRow` / `removeRow` | CRUD |
| `onboardTenant` | Create pending tenant + owner user |
| `updateTenantStatus` | Approve / reject / offboard |
| `listTenantsByStatus` | Lobby / Tenants lists |
| `platformStats` | Dashboard / analytics KPIs |
| `resetPlatformStore` | Re-seed |
| `subscribePlatform` | React sync |

Hooks:

- `usePlatformCollection(collection, tenantId)` — list + save/remove for a module
- `useAccess()` — `user`, `isSuperAdmin`, `tenantId`, `canWrite`, `tenant`, `features`, `hasFeature`

### Tenant feature flags

Catalog in `src/config/features.js`. Each tenant has a `features` map (booleans). Super Admin toggles via `/platform/permissions` → `setTenantFeature`. Tenant sidebar and routes only show enabled keys. Add-ons (`attendance`, `staff_payouts`) default off; core modules default on. Store key: `sc_platform_v10`.

---

## 6. Routing

Defined in `src/App.jsx`.

```text
/login                          Public

/                               Dashboard (role-specific)
                                └ ProtectedRoute + Layout

── Super Admin only ──────────────────────────────
/lobby                          Pending approvals + onboard
/tenants                        Active tenants + offboard
/tenants/:tenantId              Read-only inspection tabs
/platform/analytics             Cross-tenant KPIs
/platform/bookings|patients|employees   Read-only global lists
/platform/owners                Owner directory
/platform/offboarded            Restore / inspect offboarded
/platform/permissions           Per-tenant feature toggles
/platform/settings              Demo reset + environment

(Tenant owner CRUD routes are not mounted.)
```

**Guards**

| Guard | File | Rule |
|---|---|---|
| `ProtectedRoute` | `components/ProtectedRoute.jsx` | Must be logged in as Super Admin |
| `RequireSuperAdmin` | `components/RequireSuperAdmin.jsx` | `SUPER_ADMIN` only |

Unknown paths → `/`.

---

## 7. Folder structure

```text
seniorcare-admin-pannel/
├── README.md
├── docs/
│   └── ARCHITECTURE.md          ← this file
├── .cursor/rules/               Product rules for AI + humans
│   ├── project-context.mdc      Roles, routes, dummy data
│   ├── uiux-rules.mdc           Design system (teal/slate)
│   ├── auth-tenant.mdc          Auth + lifecycle
│   ├── api-conventions.mdc      Store conventions (no live API)
│   └── react-patterns.mdc       Page/component patterns
├── package.json
├── vite.config.js
├── index.html
└── src/
    ├── main.jsx                 App bootstrap
    ├── App.jsx                  Router
    ├── index.css                Global / Tailwind
    ├── config/
    │   ├── features.js          Tenant feature catalog + defaults
    │   └── modules.jsx          Shared module field/column defs
    ├── data/
    │   └── seed.js              Initial users, tenants, collections
    ├── store/
    │   └── platformStore.js     localStorage domain store
    ├── utils/
    │   ├── auth.js              Session + role helpers
    │   ├── ui.js                Shared Tailwind class tokens
    │   └── errors.js            Legacy helper (optional)
    ├── hooks/
    │   ├── useAccess.js
    │   └── usePlatformCollection.js
    ├── components/
    │   ├── Layout.jsx           Sidebar + header shell
    │   ├── WelcomeHero.jsx
    │   ├── EntityCrudPage.jsx   Generic CRUD table/modal
    │   ├── ProtectedRoute.jsx
    │   ├── RequireSuperAdmin.jsx
    │   ├── RequireTenantOwner.jsx
    │   └── ui/                  Modal, ConfirmDialog, PageState, …
    └── pages/
        ├── Login.jsx
        ├── Dashboard.jsx
        ├── Lobby.jsx
        ├── Tenants.jsx
        ├── TenantDetail.jsx
        ├── Analytics.jsx
        └── modulePages.jsx      Thin wrappers → EntityCrudPage
```

**Note:** Older inventory feature files may still exist under `src/features/inventory/` from a previous iteration; they are **not** wired into the current router. Prefer the dummy platform modules above unless inventory is re-enabled intentionally.

---

## 8. UI composition

### 8.1 Shell (`Layout.jsx`)

```text
aside (slate-900, collapsible)
  Super Admin nav: Dashboard · Lobby · Tenants
  Tenant nav: Dashboard · Analytics · Catalog · Operations
column
  header (role chip, logout confirm)
  tenant banner (owners only)
  main → max-w-[1400px] → <Outlet />
```

### 8.2 Page pattern

1. `PageHeader` (eyebrow, title, description, actions)
2. `StatusBanner` (success / error)
3. Table in `tableWrapClass` **or** KPI `Panel`s
4. `Modal` for create/edit
5. `ConfirmDialog` for delete / logout / offboard

### 8.3 Module config → CRUD

`src/config/modules.jsx` declares for each collection:

- `title`, `description`
- `columns` (table)
- `fields` (form)
- `buildEmpty`, `validate`

`modulePages.jsx` binds each to `EntityCrudPage` with `tenantId` + `canWrite` from `useAccess()`.

`TenantDetail.jsx` reuses the same configs with `canWrite={false}` for Super Admin inspection.

---

## 9. Role matrix (capabilities)

| Capability | Super Admin | Tenant Owner |
|---|---|---|
| Platform dashboard KPIs | Yes | — |
| Onboard tenant | Yes | No |
| Lobby approve / reject | Yes | No |
| Offboard tenant | Yes | No |
| View any tenant’s modules | Yes (read-only) | Own only |
| Create / edit / delete ops data | No | Yes (own tenant) |
| Analytics | Aggregate on dashboard | Full org analytics page |

---

## 10. Stack

| Layer | Choice |
|---|---|
| UI | React 19 |
| Build | Vite 8 |
| Styling | Tailwind CSS 4 |
| Routing | react-router-dom 7 |
| Icons | react-icons/fi |
| HTTP | None for product flows (dummy store) |

Scripts: `npm run dev` · `npm run build` · `npm run preview` · `npm run lint`

---

## 11. Extending the system

### Add a new tenant module

1. Add seed rows in `src/data/seed.js` (`buildSeedCollections`).
2. Ensure the collection array exists in `platformStore` empty/seed state.
3. Add a definition to `MODULE_CONFIG` in `src/config/modules.jsx`.
4. Export a page from `modulePages.jsx` and register a route in `App.jsx`.
5. Add a `NavLink` under the tenant section in `Layout.jsx`.
6. Tab appears automatically on Super Admin `TenantDetail` via `MODULE_CONFIG`.

### Wire a real API later

Suggested boundary (not implemented yet):

1. Keep `platformStore` as a repository interface (`listByTenant`, `upsertRow`, …).
2. Swap implementations: localStorage → axios/fetch adapters.
3. Reintroduce auth tokens only inside that adapter; keep pages on hooks/`useAccess`.
4. Update `.cursor/rules/api-conventions.mdc` when live APIs return.

---

## 12. Cursor rules map

| Rule file | Scope |
|---|---|
| `project-context.mdc` | Always-on product model, routes, demo logins |
| `uiux-rules.mdc` | Visual system, shell, a11y checklist |
| `auth-tenant.mdc` | Session, lobby lifecycle, write guards |
| `api-conventions.mdc` | Dummy store conventions |
| `react-patterns.mdc` | Page/component conventions |

Keep these in sync when architecture or roles change.

---

## 13. Quick mental model

```text
Login (dummy) → role?
  ├─ SUPER_ADMIN → Lobby / Tenants / read-only TenantDetail
  └─ TENANT_OWNER → CRUD modules + Analytics (scoped by tenant_id)

All mutations go through platformStore → localStorage → UI refresh via events.
```
