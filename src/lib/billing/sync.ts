import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/billing/stripe";
import {
  isActiveSubscriptionStatus,
  planAfterSubscriptionRemoved,
} from "@/lib/billing/plans";

export async function syncOrganizationFromSubscription(
  organizationId: string,
  subscription: Stripe.Subscription,
) {
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const periodEndUnix = (
    subscription as Stripe.Subscription & {
      current_period_end?: number;
    }
  ).current_period_end;
  const periodEnd =
    typeof periodEndUnix === "number"
      ? new Date(periodEndUnix * 1000)
      : null;

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
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string | { id: string } | null;
      };
      const subscriptionId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id;
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
