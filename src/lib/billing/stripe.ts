import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

export function isStripeConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_ID &&
      process.env.STRIPE_WEBHOOK_SECRET,
  );
}

/** True when Checkout can be started (secret + price). Webhook secret checked separately. */
export function isStripeCheckoutConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env to enable billing.",
    );
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key, {
      // Pin to the SDK default; avoids silent API drift across deploys.
      apiVersion: "2026-06-24.dahlia",
      typescript: true,
    });
  }
  return stripeSingleton;
}

export function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.AUTH_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function proPriceId() {
  const id = process.env.STRIPE_PRICE_ID;
  if (!id) {
    throw new Error("STRIPE_PRICE_ID is not set.");
  }
  return id;
}

export function isActiveSubscriptionStatus(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}
