<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Single Next.js 16 app (portal + admin + kiosk) backed by Postgres via Prisma. Standard scripts live in `package.json` and setup in `INSTALL.md`/`README.md`; only the non-obvious cloud caveats are below.

- **Docker is unavailable here.** The `docker compose up` step in `INSTALL.md`/`README.md` does not work. Instead, Postgres 16 is installed natively (apt) as cluster `16 main` on port `5432`. Start it each session with `sudo pg_ctlcluster 16 main start` (idempotent; safe if already running). The update script does NOT start it.
- **DB credentials/name match `docker-compose.yml`:** role `conference` / password `conference`, database `conference_booking`. If the role/db are missing after a fresh snapshot, recreate them (`CREATE ROLE conference LOGIN PASSWORD 'conference'; CREATE DATABASE conference_booking OWNER conference;`), then run `npx prisma migrate deploy` and `npm run db:seed`.
- **`.env` is gitignored** (persists in the VM snapshot, not committed). It needs at least `DATABASE_URL="postgresql://conference:conference@localhost:5432/conference_booking?schema=public"`, `AUTH_SECRET`, `AUTH_URL=http://localhost:3000`, `NEXT_PUBLIC_APP_URL=http://localhost:3000`. Leave `AUTH_RESEND_KEY` empty for local dev.
- **Seeding gotcha:** `npm run db:seed` runs `tsx prisma/seed.ts`, which does NOT auto-load `.env`. Load env first, e.g. `set -a && . ./.env && set +a && npm run db:seed`. The Prisma CLI (`migrate`/`validate`) and `next dev` DO load `.env` automatically.
- **Magic-link sign-in:** with `AUTH_RESEND_KEY` empty, no email is sent — the sign-in URL is printed to the `npm run dev` console. Grep it, e.g. `grep -Eo 'http://localhost:3000/api/auth/callback/resend[^ ]*' <dev-log>`. Seed accounts: `admin@example.com` (Owner/admin), `member@example.com` (Member).
- **Run dev server** with `npm run dev` (http://localhost:3000). CI checks (see `.github/workflows/ci.yml`): `npm run lint`, `npm run typecheck`, `npx prisma validate`, `npm run build`.
