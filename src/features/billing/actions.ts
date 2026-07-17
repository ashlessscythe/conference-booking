"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import {
  appBaseUrl,
  getStripe,
  isStripeCheckoutConfigured,
  proPriceId,
} from "@/lib/billing/stripe";

async function ensureStripeCustomer(input: {
  organizationId: string;
  email: string;
  name: string;
}) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: input.organizationId },
  });
  if (org.stripeCustomerId) {
    return org.stripeCustomerId;
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: input.email,
    name: input.name,
    metadata: { organizationId: input.organizationId },
  });

  await prisma.organization.update({
    where: { id: input.organizationId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function startProCheckout() {
  const admin = await requireAdmin();
  if (!isStripeCheckoutConfigured()) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID.",
    );
  }
  if (!admin.email) {
    throw new Error("Admin email is required for billing.");
  }

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: admin.organizationId },
  });

  const customerId = await ensureStripeCustomer({
    organizationId: org.id,
    email: admin.email,
    name: org.name,
  });

  const stripe = getStripe();
  const base = appBaseUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: org.id,
    line_items: [{ price: proPriceId(), quantity: 1 }],
    success_url: `${base}/admin/billing?success=1`,
    cancel_url: `${base}/admin/billing?canceled=1`,
    metadata: { organizationId: org.id },
    subscription_data: {
      metadata: { organizationId: org.id },
    },
    ...(org.pendingStripePromotionCodeId
      ? {
          discounts: [
            { promotion_code: org.pendingStripePromotionCodeId },
          ],
        }
      : { allow_promotion_codes: true }),
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }
  redirect(session.url);
}

export async function openBillingPortal() {
  const admin = await requireAdmin();
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: admin.organizationId },
  });
  if (!org.stripeCustomerId) {
    throw new Error("No Stripe customer yet. Upgrade to Pro first.");
  }

  const stripe = getStripe();
  const base = appBaseUrl();
  const portal = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${base}/admin/billing`,
  });

  redirect(portal.url);
}
