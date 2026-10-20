import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/billing/stripe";
import {
  isActiveSubscriptionStatus,
  planAfterSubscriptionRemoved,
} from "@/lib/billing/plans";

/**
 * Legacy top-level `invoice.subscription` (pre-2025-03-31.basil).
 * Kept for webhook payloads still on older API versions.
 */
type LegacyInvoiceFields = {
  subscription?: string | { id: string } | null;
};

/**
 * Legacy top-level `subscription.current_period_end` (pre-2025-03-31.basil).
 * Prefer `items.data[].current_period_end` on the pinned API version.
 */
type LegacySubscriptionFields = {
  current_period_end?: number;
};

function idFromExpandable(
  value: string | { id: string } | null | undefined,
): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.id === "string") {
    return value.id;
  }
  return null;
}

/**
 * Resolve the subscription ID for an invoice.
 * On API ≥ 2025-03-31.basil the ID lives at
 * `parent.subscription_details.subscription`; older payloads used
 * top-level `subscription`. Prefer the new location, fall back to legacy.
 */
export function subscriptionIdFromInvoice(
  invoice: Stripe.Invoice,
): string | null {
  const fromParent = idFromExpandable(
    invoice.parent?.subscription_details?.subscription,
  );
  if (fromParent) return fromParent;

  const legacy = invoice as Stripe.Invoice & LegacyInvoiceFields;
  return idFromExpandable(legacy.subscription);
}

/**
 * Resolve the current billing period end for a subscription.
 * On API ≥ 2025-03-31.basil period bounds live on subscription items
 * (`items.data[].current_period_end`); older payloads used top-level
 * `current_period_end`. Prefer item-level (first item), fall back to legacy.
 */
export function currentPeriodEndFromSubscription(
  subscription: Stripe.Subscription,
): Date | null {
  const fromItem = subscription.items?.data?.[0]?.current_period_end;
  if (typeof fromItem === "number") {
    return new Date(fromItem * 1000);
  }

  const legacy = subscription as Stripe.Subscription & LegacySubscriptionFields;
  if (typeof legacy.current_period_end === "number") {
    return new Date(legacy.current_period_end * 1000);
  }
  return null;
}

export async function syncOrganizationFromSubscription(
  organizationId: string,
  subscription: Stripe.Subscription,
) {
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const periodEnd = currentPeriodEndFromSubscription(subscription);

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { promoExpiresAt: true },
  });

  const stripePro = isActiveSubscriptionStatus(subscription.status);
  const planTier = stripePro
    ? "PRO"
    : planAfterSubscriptionRemoved(org);

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      planTier,
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionStatus: subscription.status,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: periodEnd,
      stripeCustomerId:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
      // Clear pending checkout promo once a subscription exists
      pendingStripePromotionCodeId: stripePro
        ? null
        : undefined,
    },
  });
}

/**
 * Pull the latest subscription for an org's Stripe customer.
 * Used when webhooks may not reach localhost after Checkout success.
 */
export async function syncOrganizationFromStripeCustomer(
  organizationId: string,
) {
  if (!process.env.STRIPE_SECRET_KEY) return null;

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { stripeCustomerId: true },
  });
  if (!org.stripeCustomerId) return null;

  const stripe = getStripe();
  const subs = await stripe.subscriptions.list({
    customer: org.stripeCustomerId,
    status: "all",
    limit: 10,
  });

  const preferred =
    subs.data.find((s) => isActiveSubscriptionStatus(s.status)) ??
    subs.data[0];
  if (!preferred) return null;

  await syncOrganizationFromSubscription(organizationId, preferred);
  return preferred;
}

export async function findOrgIdFromStripeEvent(input: {
  organizationId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
}) {
  if (input.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true },
    });
    if (org) return org.id;
  }
  if (input.subscriptionId) {
    const bySub = await prisma.organization.findFirst({
      where: { stripeSubscriptionId: input.subscriptionId },
      select: { id: true },
    });
    if (bySub) return bySub.id;
  }
  if (input.customerId) {
    const byCustomer = await prisma.organization.findFirst({
      where: { stripeCustomerId: input.customerId },
      select: { id: true },
    });
    if (byCustomer) return byCustomer.id;
  }
  return null;
}

export async function handleStripeWebhookEvent(event: Stripe.Event) {
  const stripe = getStripe();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break;
      const organizationId =
        session.metadata?.organizationId ||
        session.client_reference_id ||
        null;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      if (!subscriptionId) break;

      const orgId = await findOrgIdFromStripeEvent({
        organizationId,
        customerId:
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id,
        subscriptionId,
      });
      if (!orgId) break;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncOrganizationFromSubscription(orgId, subscription);
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const orgId = await findOrgIdFromStripeEvent({
        organizationId: subscription.metadata?.organizationId,
        customerId:
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id,
        subscriptionId: subscription.id,
      });
      if (!orgId) break;

      if (event.type === "customer.subscription.deleted") {
        const org = await prisma.organization.findUniqueOrThrow({
          where: { id: orgId },
          select: { promoExpiresAt: true },
        });
        await prisma.organization.update({
          where: { id: orgId },
          data: {
            planTier: planAfterSubscriptionRemoved(org),
            stripeSubscriptionStatus: "canceled",
            stripeSubscriptionId: null,
            stripePriceId: null,
            stripeCurrentPeriodEnd: null,
          },
        });
      } else {
        await syncOrganizationFromSubscription(orgId, subscription);
      }
      break;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = subscriptionIdFromInvoice(invoice);
      if (!subscriptionId) break;
      const orgId = await findOrgIdFromStripeEvent({
        customerId:
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id,
        subscriptionId,
      });
      if (!orgId) break;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncOrganizationFromSubscription(orgId, subscription);
      break;
    }
    default:
      break;
  }
}
