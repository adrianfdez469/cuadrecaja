# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Cuadre de Caja** is a multi-tenant Point of Sale (POS) and inventory management system. Each `Negocio` (business) owns its own stores (`Tiendas`), users, products, and sales data — all fully isolated.

## Commands

```bash
npm run dev          # Dev server with Turbopack
npm run dev:https    # Dev with HTTPS via custom server (server.mjs)
npm run build        # Production build
npm run lint         # ESLint check (run before committing)
npm start            # Start production server

npx prisma generate           # Regenerate Prisma client after schema changes
npx prisma migrate dev --name <name>  # Create and apply a new migration
npx prisma studio             # Visual DB browser
```

> No automated tests exist in this project.

## Architecture

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · MUI v6 · Zustand 5 · NextAuth 4 · Prisma 6 · PostgreSQL · Axios

### Layered Structure

| Layer | Path | Responsibility |
|-------|------|----------------|
| Pages / API Routes | `src/app/` | Routing, page components, REST endpoints |
| Components | `src/components/` | Reusable UI, organized by feature |
| Services | `src/services/` | Axios calls to API routes (one file per domain) |
| Server Logic | `src/lib/` | Business logic, Prisma singleton, report generation |
| Global State | `src/store/` | Zustand stores (cart with multi-cart + persistence, sales) |
| Context | `src/context/` | `AppContext` (user session/auth/nav), `MessageContext` (toasts) |
| Types | `src/types/` | Shared TypeScript interfaces, prefixed with `I` (e.g. `IProducto`) |
| Utils | `src/utils/` | Auth helpers, export utilities, permission helpers |

### Authentication & Authorization

- **NextAuth** with JWT strategy and Credentials provider (bcrypt password validation)
- **Middleware** (`src/middleware.ts`) decodes JWT → adds `x-user-*` headers → checks subscription status
- **Permission system:** pipe-delimited strings stored per user per store (e.g. `pos.vender|inventario.ver`), validated in both frontend (`permisos_front.ts`) and backend (`permisos_back.ts`)
- **Roles:** `vendedor`, `administrador`, `superadmin`

### Key Data Model Relationships

```
Negocio (tenant root)
  ├─ Usuarios  ──[UsuarioTienda]──> Tiendas (stores)
  ├─ Tiendas
  │    ├─ ProductoTienda (per-store stock & price)
  │    ├─ Ventas (sales)
  │    ├─ MovimientoStock (COMPRA | VENTA | TRASPASO_* | AJUSTE_* | DESAGREGACION_*)
  │    └─ CierrePeriodo (period closing)
  └─ Productos
       ├─ fraccionDeId → parent Producto (for fractioned products, e.g. loose cigarettes)
       └─ ProductoTienda (links to stores with stock/price)
```

### POS / Cart

- Cart state lives in `src/store/cartStore.ts` (Zustand with LocalStorage persistence)
- Supports multiple named carts (accounts/bills) switchable at runtime
- Sales support offline sync: `syncId`, `wasOffline`, `syncAttempts` fields
- Axios has a retry interceptor (2 retries) for network failures

### Subscription System

- `Negocio.limitTime` controls subscription expiry; 7-day grace period
- `Negocio.suspended` is a manual kill switch
- Middleware blocks non-`SUPER_ADMIN` logins when expired/suspended

## Code Conventions

- **Naming:** Components → PascalCase; functions/variables → camelCase; interfaces → PascalCase with `I` prefix
- **Imports:** Use `@/` alias for all `src/` imports
- **TypeScript:** Avoid `any`; justify with a comment when unavoidable. Strict mode is disabled.
- **"use client":** Only add to files that actually need browser hooks or interactivity
- **No prop drilling:** Use Zustand or Context for shared state
- **No Prisma in components:** Keep DB access in API routes and `src/lib/`
- **No magic strings/numbers:** Use constants from `src/constants/`
- **Shared interfaces:** Never duplicate types between service and view layers — use the types in `src/types/`

## Commit Style (Conventional Commits)

`feat:` · `fix:` · `refactor:` · `docs:` · `style:` · `chore:`

Branch naming: `feature/description` or `fix/description` (issue branches use issue number, e.g. `159-bug-...`)

## Environment Variables

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."   # Required by Prisma (direct connection, no pooling)
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
INIT_SECRET="..."               # Used to bootstrap the first superadmin via /api/init-superadmin
```
