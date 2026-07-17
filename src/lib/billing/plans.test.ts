import { describe, expect, it } from "vitest";
import {
  assertBookingFitsPlan,
  allowsCustomMeetingLength,
  bookingStepMinutesForPlan,
  canAddSeat,
  canAddSeatForOrg,
  canCreateRoom,
  canCreateRoomForOrg,
  FREE_BOOKING_DURATION_MIN,
  FREE_BOOKING_STEP_MIN,
  FREE_ROOM_LIMIT,
  FREE_USER_LIMIT,
  minBookingDurationMinutesForPlan,
  planAfterSubscriptionRemoved,
  PRO_BOOKING_STEP_MIN,
  PRO_MIN_BOOKING_DURATION_MIN,
  resolveEffectivePlan,
  roomLimitForPlan,
  userLimitForPlan,
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
    expect(FREE_ROOM_LIMIT).toBe(4);
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

describe("seat limits", () => {
  it("caps free orgs at FREE_USER_LIMIT seats", () => {
    expect(userLimitForPlan("FREE")).toBe(FREE_USER_LIMIT);
    expect(FREE_USER_LIMIT).toBe(2);
    expect(
      canAddSeat({ planTier: "FREE", currentSeatCount: FREE_USER_LIMIT - 1 }),
    ).toBe(true);
    expect(
      canAddSeat({ planTier: "FREE", currentSeatCount: FREE_USER_LIMIT }),
    ).toBe(false);
  });

  it("allows Pro to add seats beyond the free limit", () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    expect(
      canAddSeatForOrg(
        {
          planTier: "PRO",
          stripeSubscriptionStatus: "active",
          currentSeatCount: FREE_USER_LIMIT,
        },
        now,
      ),
    ).toBe(true);
  });

  it("blocks seats after promo expires", () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    expect(
      canAddSeatForOrg(
        {
          planTier: "PRO",
          promoExpiresAt: new Date("2026-06-01T12:00:00.000Z"),
          currentSeatCount: FREE_USER_LIMIT,
        },
        now,
      ),
    ).toBe(false);
  });
});

describe("booking duration entitlements", () => {
  it("exposes plan step and duration rules", () => {
    expect(bookingStepMinutesForPlan("FREE")).toBe(FREE_BOOKING_STEP_MIN);
    expect(bookingStepMinutesForPlan("PRO")).toBe(PRO_BOOKING_STEP_MIN);
    expect(minBookingDurationMinutesForPlan("FREE")).toBe(
      FREE_BOOKING_DURATION_MIN,
    );
    expect(minBookingDurationMinutesForPlan("PRO")).toBe(
      PRO_MIN_BOOKING_DURATION_MIN,
    );
    expect(allowsCustomMeetingLength("FREE")).toBe(false);
    expect(allowsCustomMeetingLength("PRO")).toBe(true);
  });

  it("accepts a free 30-minute half-hour booking", () => {
    expect(() =>
      assertBookingFitsPlan({
        planTier: "FREE",
        startAt: new Date(2026, 6, 17, 10, 0, 0, 0),
        endAt: new Date(2026, 6, 17, 10, 30, 0, 0),
      }),
    ).not.toThrow();
  });

  it("rejects free bookings that are not exactly 30 minutes", () => {
    expect(() =>
      assertBookingFitsPlan({
        planTier: "FREE",
        startAt: new Date(2026, 6, 17, 10, 0, 0, 0),
        endAt: new Date(2026, 6, 17, 11, 0, 0, 0),
      }),
    ).toThrow(/fixed at 30 minutes/i);
  });

  it("rejects free bookings off the half-hour", () => {
    expect(() =>
      assertBookingFitsPlan({
        planTier: "FREE",
        startAt: new Date(2026, 6, 17, 10, 15, 0, 0),
        endAt: new Date(2026, 6, 17, 10, 45, 0, 0),
      }),
    ).toThrow(/half hour/i);
  });

  it("accepts Pro custom lengths on 15-minute boundaries", () => {
    expect(() =>
      assertBookingFitsPlan({
        planTier: "PRO",
        startAt: new Date(2026, 6, 17, 10, 15, 0, 0),
        endAt: new Date(2026, 6, 17, 11, 0, 0, 0),
      }),
    ).not.toThrow();
  });

  it("accepts Pro minimum 15-minute meetings", () => {
    expect(() =>
      assertBookingFitsPlan({
        planTier: "PRO",
        startAt: new Date(2026, 6, 17, 10, 0, 0, 0),
        endAt: new Date(2026, 6, 17, 10, 15, 0, 0),
      }),
    ).not.toThrow();
  });

  it("rejects Pro bookings with inverted times", () => {
    expect(() =>
      assertBookingFitsPlan({
        planTier: "PRO",
        startAt: new Date(2026, 6, 17, 10, 30, 0, 0),
        endAt: new Date(2026, 6, 17, 10, 0, 0, 0),
      }),
    ).toThrow(/after start time/i);
  });

  it("rejects Pro bookings off the 15-minute grid", () => {
    expect(() =>
      assertBookingFitsPlan({
        planTier: "PRO",
        startAt: new Date(2026, 6, 17, 10, 5, 0, 0),
        endAt: new Date(2026, 6, 17, 10, 35, 0, 0),
      }),
    ).toThrow(/15-minute boundary/i);
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
