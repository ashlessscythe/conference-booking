import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import {
  openBillingPortal,
  startProCheckout,
} from "@/features/billing/actions";
import {
  FREE_ROOM_LIMIT,
  planLabel,
  roomLimitForPlan,
} from "@/lib/billing/plans";
import {
  isStripeCheckoutConfigured,
  isStripeConfigured,
} from "@/lib/billing/stripe";
import { Button } from "@/components/ui/button";
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
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const admin = await requireAdmin();
  const q = await searchParams;
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: admin.organizationId },
    include: { _count: { select: { rooms: true } } },
  });

  const checkoutReady = isStripeCheckoutConfigured();
  const fullyConfigured = isStripeConfigured();
  const isPro = org.planTier === "PRO";
  const limit = roomLimitForPlan(org.planTier);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Billing</h2>
        <p className="text-muted-foreground">
          Manage the plan for {org.name}. Free includes {FREE_ROOM_LIMIT} rooms;
          Pro unlocks more.
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
          Checkout canceled — you are still on {planLabel(org.planTier)}.
        </p>
      )}

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Current plan: {planLabel(org.planTier)}</CardTitle>
          <CardDescription>
            {org._count.rooms} / {limit} rooms
            {org.stripeSubscriptionStatus
              ? ` · Stripe: ${org.stripeSubscriptionStatus}`
              : ""}
            {org.stripeCurrentPeriodEnd
              ? ` · renews ${org.stripeCurrentPeriodEnd.toLocaleDateString()}`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!checkoutReady ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Add these environment variables to monetize (Stripe Dashboard →
                Developers → API keys, Products → Price ID, Webhooks):
              </p>
              <ul className="list-disc space-y-1 pl-5 font-mono text-xs">
                <li>STRIPE_SECRET_KEY</li>
                <li>STRIPE_PRICE_ID</li>
                <li>STRIPE_WEBHOOK_SECRET</li>
                <li>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (optional)</li>
              </ul>
              <p>
                Webhook endpoint:{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  /api/stripe/webhook
                </code>{" "}
                — events:{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  checkout.session.completed
                </code>
                ,{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  customer.subscription.*
                </code>
                ,{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  invoice.paid
                </code>
                ,{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  invoice.payment_failed
                </code>
                .
              </p>
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
    </div>
  );
}
