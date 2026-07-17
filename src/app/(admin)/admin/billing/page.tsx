import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import {
  openBillingPortal,
  startProCheckout,
} from "@/features/billing/actions";
import { redeemPromoCodeForm } from "@/features/billing/promo-actions";
import {
  FREE_ROOM_LIMIT,
  planLabel,
  resolveEffectivePlan,
  roomLimitForPlan,
} from "@/lib/billing/plans";
import {
  isStripeCheckoutConfigured,
  isStripeConfigured,
} from "@/lib/billing/stripe";
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
  }>;
}) {
  const admin = await requireAdmin();
  const q = await searchParams;
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Billing</h2>
        <p className="text-muted-foreground">
          Manage the plan for {org.name}. Free includes {FREE_ROOM_LIMIT} rooms;
          Pro unlocks more. Redeem a promo for free months or checkout
          discounts.
        </p>
      </div>

      {q.success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
          Checkout completed. If Pro is not showing yet, wait a moment for the
          Stripe webhook (or refresh).
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
              <p>
                Add Stripe env vars to take paid upgrades. Promo codes for free
                months still work without Stripe.
              </p>
              <ul className="list-disc space-y-1 pl-5 font-mono text-xs">
                <li>STRIPE_SECRET_KEY</li>
                <li>STRIPE_PRICE_ID</li>
                <li>STRIPE_WEBHOOK_SECRET</li>
              </ul>
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
              {!fullyConfigured && (
                <p className="w-full text-sm text-amber-800 dark:text-amber-200">
                  Checkout works, but set STRIPE_WEBHOOK_SECRET so plan changes
                  sync automatically after payment.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Redeem promo code</CardTitle>
          <CardDescription>
            Free-month codes unlock Pro immediately. Discount codes attach to
            your next Checkout.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={redeemPromoCodeForm} className="flex flex-col gap-3 sm:flex-row">
            <Input
              name="code"
              required
              placeholder="LAUNCH30"
              className="h-11 font-mono uppercase"
              autoComplete="off"
            />
            <Button type="submit" className="h-11 shrink-0">
              Redeem
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
