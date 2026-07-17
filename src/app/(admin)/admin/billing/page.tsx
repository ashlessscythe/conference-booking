import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import {
  openBillingPortal,
  startProCheckout,
} from "@/features/billing/actions";
import { redeemPromoCodeForm } from "@/features/billing/promo-actions";
import {
  FREE_ROOM_LIMIT,
  FREE_USER_LIMIT,
  isActiveSubscriptionStatus,
  planLabel,
  resolveEffectivePlan,
  roomLimitForPlan,
} from "@/lib/billing/plans";
import {
  isStripeCheckoutConfigured,
  isStripeConfigured,
} from "@/lib/billing/stripe";
import { syncOrganizationFromStripeCustomer } from "@/lib/billing/sync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    success?: string;
    canceled?: string;
    promo?: string;
    promoError?: string;
  }>;
}) {
  const admin = await requireAdmin();
  const q = await searchParams;

  // Checkout success (and stale local state) — sync from Stripe when webhooks
  // may not have reached this environment.
  {
    const peek = await prisma.organization.findUniqueOrThrow({
      where: { id: admin.organizationId },
      select: {
        stripeCustomerId: true,
        stripeSubscriptionStatus: true,
        promoExpiresAt: true,
        planTier: true,
      },
    });
    const currentlyPro = resolveEffectivePlan(peek) === "PRO";
    if (
      peek.stripeCustomerId &&
      (q.success || !currentlyPro)
    ) {
      try {
        await syncOrganizationFromStripeCustomer(admin.organizationId);
      } catch (err) {
        console.error("Stripe billing sync failed:", err);
      }
    }
  }

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: admin.organizationId },
    include: { _count: { select: { rooms: true } } },
  });

  const checkoutReady = isStripeCheckoutConfigured();
  const fullyConfigured = isStripeConfigured();
  const now = new Date();
  const effective = resolveEffectivePlan(org, now);
  const isPro = effective === "PRO";
  const limit = roomLimitForPlan(effective);
  const promoActive =
    Boolean(org.promoExpiresAt) &&
    org.promoExpiresAt!.getTime() > now.getTime();
  const paidPro = isActiveSubscriptionStatus(org.stripeSubscriptionStatus);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Billing</h2>
        <p className="text-muted-foreground">
          {isPro
            ? paidPro
              ? `${org.name} is on Pro with the full room limit.`
              : promoActive && org.promoExpiresAt
                ? `${org.name} is on Pro via promo through ${org.promoExpiresAt.toLocaleDateString()}.`
                : `${org.name} is on Pro with the full room limit.`
            : `Manage the plan for ${org.name}. Free includes ${FREE_ROOM_LIMIT} rooms, ${FREE_USER_LIMIT} users, and fixed 30-minute meetings. Pro unlocks unlimited rooms and seats, 15-minute scheduling, and custom meeting lengths. Redeem a promo for free months or checkout discounts.`}
        </p>
      </div>

      {q.success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
          {isPro
            ? "You're on Pro. Free-plan room, seat, and duration limits no longer apply."
            : "Checkout completed. If Pro is not showing yet, wait a moment and refresh — or confirm the Stripe webhook is reaching this app."}
        </p>
      )}
      {q.canceled && (
        <p className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">
          Checkout canceled — you are still on {planLabel(effective)}.
        </p>
      )}
      {q.promo && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
          Promo applied.
          {promoActive && org.promoExpiresAt
            ? ` Pro access through ${org.promoExpiresAt.toLocaleDateString()}.`
            : org.pendingStripePromotionCodeId
              ? " Discount will apply on the next Checkout."
              : ""}
        </p>
      )}
      {q.promoError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
          {q.promoError}
        </p>
      )}

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Current plan: {planLabel(effective)}</CardTitle>
          <CardDescription>
            {org._count.rooms} / {limit} rooms
            {org.stripeSubscriptionStatus
              ? ` · Stripe: ${org.stripeSubscriptionStatus}`
              : ""}
            {org.stripeCurrentPeriodEnd
              ? ` · renews ${org.stripeCurrentPeriodEnd.toLocaleDateString()}`
              : ""}
            {promoActive && org.promoExpiresAt
              ? ` · promo until ${org.promoExpiresAt.toLocaleDateString()}`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!checkoutReady ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              {isPro ? (
                <p>
                  Pro is active
                  {promoActive ? " via promo" : ""}. Add Stripe env vars when
                  you want paid renewals and the customer portal.
                </p>
              ) : (
                <>
                  <p>
                    Add Stripe env vars to take paid upgrades. Promo codes for
                    free months still work without Stripe.
                  </p>
                  <ul className="list-disc space-y-1 pl-5 font-mono text-xs">
                    <li>STRIPE_SECRET_KEY</li>
                    <li>STRIPE_PRICE_ID</li>
                    <li>STRIPE_WEBHOOK_SECRET</li>
                  </ul>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {!isPro && (
                <form action={startProCheckout}>
                  <Button type="submit" className="h-11">
                    Upgrade to Pro
                  </Button>
                </form>
              )}
              {isPro && !org.stripeCustomerId && promoActive && (
                <form action={startProCheckout}>
                  <Button type="submit" variant="outline" className="h-11">
                    Add payment method
                  </Button>
                </form>
              )}
              {org.stripeCustomerId && (
                <form action={openBillingPortal}>
                  <Button type="submit" variant="outline" className="h-11">
                    Manage subscription
                  </Button>
                </form>
              )}
              {!fullyConfigured && !isPro && (
                <p className="w-full text-sm text-amber-800 dark:text-amber-200">
                  Checkout works, but set STRIPE_WEBHOOK_SECRET so plan changes
                  sync automatically after payment.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {!paidPro && (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Redeem promo code</CardTitle>
            <CardDescription>
              {isPro
                ? "Discount codes can still attach for when you add a payment method."
                : "Free-month codes unlock Pro immediately. Discount codes attach to your next Checkout."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={redeemPromoCodeForm}
              className="flex flex-col gap-3 sm:flex-row"
            >
              <Input
                name="code"
                required
                placeholder="DEMO3MO"
                className="h-11 font-mono uppercase"
                autoComplete="off"
              />
              <Button type="submit" className="h-11 shrink-0">
                Redeem
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
