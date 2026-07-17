# Installation

## Prerequisites

- Node.js 22+
- npm 10+
- Docker (for local PostgreSQL), or any Postgres 16 instance

## Setup

```bash
cp .env.example .env
docker compose up -d
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

If Docker is unavailable, set `DATABASE_URL` in `.env` to any reachable Postgres database, then run migrate + seed.

## Stripe (optional)

To sell Pro upgrades, set in `.env`:

```
STRIPE_SECRET_KEY=sk_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Point Stripe webhooks at `/api/stripe/webhook`. Without these, every new org stays on the free 2-room plan.

## Magic links (local)

Leave `AUTH_RESEND_KEY` empty. Request a sign-in, then copy the magic link from the `npm run dev` console.

## Verify CI locally

```bash
npm run lint
npm run typecheck
npx prisma validate
npm run build
```

See [README.md](README.md) for URLs and seed accounts.
