import { describe, expect, it } from "vitest";
import { planAfterSubscriptionRemoved } from "@/lib/billing/plans";

/**
 * Money-path regression: canceling Stripe must not strip an active free-month promo.
 * Mirrors the branch used in stripe webhook sync.
 */
describe("subscription cancel vs promo grant", () => {
  const now = new Date("2026-07-17T12:00:00.000Z");

  it("does not revoke unexpired FREE_MONTHS grant on subscription.deleted", () => {
    const nextTier = planAfterSubscriptionRemoved(
      { promoExpiresAt: new Date("2026-08-17T12:00:00.000Z") },
      now,
    );
    expect(nextTier).toBe("PRO");
  });

  it("revokes access when canceling with no promo window", () => {
    expect(planAfterSubscriptionRemoved({ promoExpiresAt: null }, now)).toBe(
      "FREE",
    );
  });
});
