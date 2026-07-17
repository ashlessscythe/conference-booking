import { describe, expect, it } from "vitest";
import {
  canCreateRoom,
  canCreateRoomForOrg,
  FREE_ROOM_LIMIT,
  planAfterSubscriptionRemoved,
  resolveEffectivePlan,
  roomLimitForPlan,
} from "@/lib/billing/plans";

describe("resolveEffectivePlan", () => {
  const now = new Date("2026-07-17T12:00:00.000Z");

  it("returns PRO for active Stripe subscription", () => {
    expect(
      resolveEffectivePlan(
        {
          planTier: "FREE",
          stripeSubscriptionStatus: "active",
          promoExpiresAt: null,
        },
        now,
      ),
    ).toBe("PRO");
  });

  it("returns PRO for trialing Stripe subscription", () => {
    expect(
      resolveEffectivePlan(
        {
          planTier: "FREE",
          stripeSubscriptionStatus: "trialing",
        },
        now,
      ),
    ).toBe("PRO");
  });

  it("returns PRO while promo window is open", () => {
    expect(
      resolveEffectivePlan(
        {
          planTier: "PRO",
          stripeSubscriptionStatus: null,
          promoExpiresAt: new Date("2026-08-17T12:00:00.000Z"),
        },
        now,
      ),
    ).toBe("PRO");
  });

  it("returns FREE when promo expired even if planTier still PRO", () => {
    expect(
      resolveEffectivePlan(
        {
          planTier: "PRO",
          stripeSubscriptionStatus: "canceled",
          promoExpiresAt: new Date("2026-06-01T12:00:00.000Z"),
        },
        now,
      ),
    ).toBe("FREE");
  });

  it("returns PRO for seed/ops Pro without promo or stripe", () => {
    expect(
      resolveEffectivePlan(
        {
          planTier: "PRO",
          stripeSubscriptionStatus: null,
          promoExpiresAt: null,
        },
        now,
      ),
    ).toBe("PRO");
  });

  it("returns FREE by default", () => {
    expect(
      resolveEffectivePlan(
        { planTier: "FREE", stripeSubscriptionStatus: null },
        now,
      ),
    ).toBe("FREE");
  });
});

describe("room limits", () => {
  it("caps free orgs at FREE_ROOM_LIMIT", () => {
    expect(roomLimitForPlan("FREE")).toBe(FREE_ROOM_LIMIT);
    expect(
      canCreateRoom({ planTier: "FREE", currentRoomCount: FREE_ROOM_LIMIT - 1 }),
    ).toBe(true);
    expect(
      canCreateRoom({ planTier: "FREE", currentRoomCount: FREE_ROOM_LIMIT }),
    ).toBe(false);
  });

  it("allows promo-granted Pro to exceed free room limit", () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    expect(
      canCreateRoomForOrg(
        {
          planTier: "PRO",
          promoExpiresAt: new Date("2026-08-17T12:00:00.000Z"),
          currentRoomCount: FREE_ROOM_LIMIT,
        },
        now,
      ),
    ).toBe(true);
  });

  it("blocks create after promo expires", () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    expect(
      canCreateRoomForOrg(
        {
          planTier: "PRO",
          promoExpiresAt: new Date("2026-06-01T12:00:00.000Z"),
          currentRoomCount: FREE_ROOM_LIMIT,
        },
        now,
      ),
    ).toBe(false);
  });
});

describe("planAfterSubscriptionRemoved", () => {
  const now = new Date("2026-07-17T12:00:00.000Z");

  it("keeps Pro when promo still valid", () => {
    expect(
      planAfterSubscriptionRemoved(
        { promoExpiresAt: new Date("2026-08-01T00:00:00.000Z") },
        now,
      ),
    ).toBe("PRO");
  });

  it("drops to Free when promo missing or expired", () => {
    expect(planAfterSubscriptionRemoved({ promoExpiresAt: null }, now)).toBe(
      "FREE",
    );
    expect(
      planAfterSubscriptionRemoved(
        { promoExpiresAt: new Date("2026-01-01T00:00:00.000Z") },
        now,
      ),
    ).toBe("FREE");
  });
});
