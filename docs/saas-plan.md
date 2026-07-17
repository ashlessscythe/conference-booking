# SaaS monetization plan

Sell Conference Booking as multi-tenant SaaS. Organizations own rooms, members, devices, and billing. Users belong to orgs via memberships (and invites).

## Product rules

| Plan | Rooms | How unlocked |
|------|-------|----------------|
| Free | Up to **2** | Default on signup |
| Pro | Unlimited (practical cap) | Stripe subscription |

## PR split

### PR 1 — Tenancy, signup, free limits, invites
- Session-scoped org isolation (stop using “first org in DB”)
- Self-serve signup → create org as Owner
- Enforce free room limit in admin
- Landing + in-app copy for free tier / upgrade
- Org invites with email + accept token
- Membership checks on booking create

### PR 2 — Stripe billing
- Env-only keys: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, optional publishable key
- Checkout + Customer Portal + webhook → flip org to Pro
- Admin **Billing** page; room create gates on plan
- Works when Stripe env is empty (dev stays Free)

## Monetize checklist

1. Create a Stripe Product with a recurring Price
2. Set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` in the host env
3. Point Stripe webhook to `/api/stripe/webhook`
4. Set `PLATFORM_OWNER_EMAILS` to your email(s) to manage promo codes
5. Owners upgrade from **Admin → Billing**; platform owners create codes at **Admin → Promo codes**

### Promo codes

| Kind | Effect |
|------|--------|
| `FREE_MONTHS` | Grants Pro until `now + N months` (works without Stripe) |
| `PERCENT_OFF` / `AMOUNT_OFF` | Syncs to Stripe Promotion Code; applied on Checkout |

Orgs redeem codes on **Admin → Billing**. Redemptions are one-per-org and respect max uses / expiry.

## Tenancy model

```
User ──< Membership >── Organization ──< Room / Device / Settings / Invitation
                              │
                         Stripe customer + subscription (PR 2)
```

- Portal lists rooms for the signed-in user’s active org only
- Admin mutations already filter by `admin.organizationId`; keep that invariant
- Public QR `/rooms/{slug}` stays shareable; booking requires membership in that room’s org
