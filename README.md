# Senior Care Platform — Admin Panel

**Super Admin–only** multi-tenant ops console: onboard tenants, set feature permissions, and inspect organization data (read-only).

Shell inspired by [FoodValve Admin](https://admin.foodvalve.com/dashboard) — dark sidebar, dense tables, sky + slate system. **No live API** — dummy seed + `localStorage`.

Tenant owner accounts **cannot sign in** to this panel.

## Super Admin can

- Onboard / approve / offboard tenants (Lobby → Tenants → Offboarded)
- Grant module permissions per tenant
- Inspect any tenant’s catalog and ops data (read-only)
- View platform analytics and cross-tenant lists

## Stack

React 19 · Vite · Tailwind 4 · react-router-dom · react-icons/fi

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Docs

- [Project overview](docs/PROJECT_OVERVIEW.md) — purpose, features, permissions ([PDF](docs/PROJECT_OVERVIEW.pdf))
- [Architecture & structure](docs/ARCHITECTURE.md) — store, routes, folders, extension guide

## Cursor rules

See `.cursor/rules/` (`project-context`, `uiux-rules`, `auth-tenant`, `api-conventions`, `react-patterns`).
