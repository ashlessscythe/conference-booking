# Conference Booking

Conference room booking with three surfaces sharing one Next.js backend:

1. **User portal** — availability, search, book/edit/cancel, QR room pages  
2. **Admin** — SaaS-style dashboard for orgs, rooms, bookings, users, devices, QR, settings  
3. **Room display (kiosk)** — fullscreen tablet UI at `/display/{deviceToken}`

## Stack

- Next.js App Router (TypeScript)
- Prisma + PostgreSQL
- Auth.js magic link (Resend; console fallback in local/dev)
- Tailwind CSS + shadcn/ui

## Quick start

```bash
# 1. Env
cp .env.example .env

# 2. Database
docker compose up -d
npm install
npx prisma migrate dev --name init
npm run db:seed

# 3. App
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Seed accounts

| Email | Role |
|-------|------|
| `admin@example.com` | Owner (admin) |
| `member@example.com` | Member |

Magic links print to the **dev server console** when `AUTH_RESEND_KEY` is empty.

### Useful URLs

- Landing: `/`
- Rooms dashboard: `/rooms`
- Room (QR): `/rooms/orion`
- Book: `/rooms/orion/book`
- Admin: `/admin` (after signing in as admin)
- Kiosk: `/display/demo-orion-kiosk`

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Production build |
| `npm run db:migrate` | Prisma migrate |
| `npm run db:seed` | Seed demo data |

## CI

GitHub Actions runs lint, typecheck, Prisma validate, and build on pushes/PRs to `main`.

## Project layout

```
src/
  app/           # routes (portal, admin, kiosk, api)
  features/      # auth, rooms, bookings, devices, kiosks, ...
  components/ui/ # shadcn primitives
  lib/           # db, auth, room-status, utils
prisma/          # schema + seed
docs/todo.md     # post-MVP backlog
```

## MVP status

Milestones M0–M6 from the implementation plan are included: scaffold/CI, auth+schema, bookings+status, dashboard/calendar, public QR rooms, kiosk devices, admin polish.

Deferred work lives in [`docs/todo.md`](docs/todo.md).
