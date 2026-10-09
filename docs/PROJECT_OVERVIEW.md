# Senior Care Platform — Project Overview

Product-facing guide: what this admin panel is for, who uses it, and which features it includes.

> PDF copy: [PROJECT_OVERVIEW.pdf](./PROJECT_OVERVIEW.pdf)

For technical structure (folders, store, routes, extension tips), see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## What it is

**Senior Care Admin** is a **Super Admin–only** multi-tenant operations console for a senior-care platform. The platform operator onboards care organizations (tenants), grants module permissions, and inspects each organization’s data — without a separate tenant login in this build.

This build is a **front-end demo**: authentication and domain data are stored locally (seed + browser `localStorage`). There is no live care API wired in.

---

## Who uses it

| Role | Who | Purpose |
|---|---|---|
| **Super Admin** | Platform operator | Sign in to the panel; onboard / approve / offboard tenants; set feature permissions; inspect org data read-only |

**Tenant Owner accounts are not allowed to sign in.** Owner records may still be created during onboarding (for the Owners directory), but they cannot access this admin panel.

Vaishnavi Medicare, CarePlus Homes, and similar names in the seed are **example tenants**, not the product brand.

---

## Why it exists

Senior-care businesses often need:

- A **platform layer** to bring clinics / home-care firms onto the product
- Clear **lifecycle** for pending → active → offboarded organizations
- **Selective modules** (e.g. attendance or staff payouts) configured per tenant by the platform operator

This panel models that Super Admin workflow end-to-end in the browser.

---

## Tenant lifecycle

```text
Onboard (Super Admin)
        ↓
   Lobby · pending
        ↓ Approve
   Tenants · active  →  Super Admin can inspect + set permissions
        ↓ Offboard / reject
   Offboarded
```

**Onboarding** can capture org basics (name, type, domain, code, logo, address, city, phone), optional Ops Admin contact, vendor-related settings, and employee offboarding / sign-in preferences.

---

## Features (Super Admin)

| Area | What you can do |
|---|---|
| **Dashboard** | Platform snapshot and shortcuts |
| **Lobby** | Approve or reject pending onboarding requests |
| **Tenants** | Create tenants; list active orgs; read-only inspection; offboard |
| **Offboarded** | See removed orgs; restore when needed |
| **Insights** | Cross-tenant analytics and read-only bookings / patients / employees |
| **Owners** | Directory of tenant owner / ops admin contacts (no login) |
| **Permissions** | Turn modules on/off **per tenant** and **per login role** (Tenant Admin vs Ops Admin) |
| **Settings** | Demo environment controls (e.g. reset local demo data) |
| **Tenant detail** | Read-only tabs for that org’s catalog and ops data |

Super Admin **cannot** create, edit, or delete tenant catalog/ops records — inspection only.

---

## Permissions (feature access)

Super Admin uses **Permissions** to choose which modules each tenant is entitled to, separately for **Tenant Admin** and **Ops Admin** logins (e.g. Vaishnavi: `owner@vaishnavi.com` / `ops@vaishnavi.com`).

- **Core** features default **on** for new tenants (catalog, ops, analytics).
- **Add-ons** (Attendance, Staff payouts) default **off** until enabled.

This records product entitlements for each organization even though tenants do not log into this panel.

---

## Module catalog (tenant entitlements)

| Group | Modules |
|---|---|
| **Core / org** | Analytics |
| **Catalog** | Services, Venues, Packages |
| **Operations** | Bookings, Patients, Employees, Vendors, Vendor payments |
| **Add-ons** | Attendance, Staff payouts |

---

## Product UX principles

- Dense **ops admin** UI: tables, toolbars, modals
- Dark sidebar + light content shell
- **Sky + slate** visual system
- Clear loading, empty, error, and success states
- Destructive actions go through confirm dialogs

---

## Stack (summary)

| Layer | Choice |
|---|---|
| UI | React 19, Vite, Tailwind 4 |
| Routing | react-router-dom (Super Admin guards) |
| Icons | `react-icons/fi` |
| Data | Dummy seed + `platformStore` → `localStorage` |

---

## How to run

```bash
npm install
npm run dev
```

Other scripts: `npm run build` · `npm run preview` · `npm run lint`

---

## Related docs

| Doc | Contents |
|---|---|
| [README.md](../README.md) | Quick start, scripts |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Folders, store, routes, guards |
| `.cursor/rules/` | Product and UI rules for contributors / AI |
