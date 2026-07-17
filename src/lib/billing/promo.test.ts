import { describe, expect, it } from "vitest";
import {
  addMonths,
  isPlatformOwnerEmail,
  normalizePromoCode,
  validateCreatePromo,
  validatePromoForRedeem,
  type PromoCodeRecord,
} from "@/lib/billing/promo";

function basePromo(
  overrides: Partial<PromoCodeRecord> = {},
): PromoCodeRecord {
  return {
    id: "promo_1",
    code: "LAUNCH1",
    kind: "FREE_MONTHS",
    active: true,
    freeMonths: 1,
    percentOff: null,
    amountOffCents: null,
    durationMonths: 1,
    maxRedemptions: null,
    redemptionCount: 0,
    expiresAt: null,
    stripePromotionCodeId: null,
    ...overrides,
  };
}

describe("normalizePromoCode", () => {
  it("uppercases and strips spaces", () => {
    expect(normalizePromoCode("  launch 30 ")).toBe("LAUNCH30");
  });
});

describe("addMonths", () => {
  it("adds calendar months", () => {
    const start = new Date("2026-01-15T00:00:00.000Z");
    const next = addMonths(start, 1);
    expect(next.getUTCMonth()).toBe(1);
    expect(next.getUTCDate()).toBe(15);
  });
});

describe("validatePromoForRedeem", () => {
  const now = new Date("2026-07-17T12:00:00.000Z");

  it("rejects missing codes", () => {
    const result = validatePromoForRedeem({
      promo: null,
      organizationId: "org_1",
      alreadyRedeemedByOrg: false,
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("rejects inactive, expired, maxed, and duplicate redemptions", () => {
    expect(
      validatePromoForRedeem({
        promo: basePromo({ active: false }),
        organizationId: "org_1",
        alreadyRedeemedByOrg: false,
        now,
      }).ok,
    ).toBe(false);

    expect(
      validatePromoForRedeem({
        promo: basePromo({ expiresAt: new Date("2026-01-01T00:00:00.000Z") }),
        organizationId: "org_1",
        alreadyRedeemedByOrg: false,
        now,
      }).ok,
    ).toBe(false);

    expect(
      validatePromoForRedeem({
        promo: basePromo({ maxRedemptions: 5, redemptionCount: 5 }),
        organizationId: "org_1",
        alreadyRedeemedByOrg: false,
        now,
      }).ok,
    ).toBe(false);

    expect(
      validatePromoForRedeem({
        promo: basePromo(),
        organizationId: "org_1",
        alreadyRedeemedByOrg: true,
        now,
      }).ok,
    ).toBe(false);
  });

  it("grants one free month of Pro", () => {
    const result = validatePromoForRedeem({
      promo: basePromo({ freeMonths: 1 }),
      organizationId: "org_1",
      alreadyRedeemedByOrg: false,
      now,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe("FREE_MONTHS");
      expect(result.promoExpiresAt?.toISOString()).toBe(
        addMonths(now, 1).toISOString(),
      );
      expect(result.message).toMatch(/1 month/i);
    }
  });

  it("accepts percent-off checkout promos", () => {
    const result = validatePromoForRedeem({
      promo: basePromo({
        kind: "PERCENT_OFF",
        freeMonths: null,
        percentOff: 50,
        durationMonths: 3,
        stripePromotionCodeId: "promo_stripe_1",
      }),
      organizationId: "org_1",
      alreadyRedeemedByOrg: false,
      now,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.percentOff).toBe(50);
      expect(result.stripePromotionCodeId).toBe("promo_stripe_1");
      expect(result.promoExpiresAt).toBeNull();
    }
  });

  it("rejects misconfigured free-month promo", () => {
    const result = validatePromoForRedeem({
      promo: basePromo({ freeMonths: 0 }),
      organizationId: "org_1",
      alreadyRedeemedByOrg: false,
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_CONFIG");
  });
});

describe("validateCreatePromo", () => {
  it("normalizes and accepts free-month codes", () => {
    const result = validateCreatePromo({
      code: "hello-world",
      kind: "FREE_MONTHS",
      freeMonths: 2,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toBe("HELLO-WORLD");
      expect(result.data.freeMonths).toBe(2);
    }
  });

  it("rejects bad codes and percent values", () => {
    expect(
      validateCreatePromo({ code: "ab", kind: "FREE_MONTHS", freeMonths: 1 }).ok,
    ).toBe(false);
    expect(
      validateCreatePromo({
        code: "SAVE",
        kind: "PERCENT_OFF",
        percentOff: 150,
      }).ok,
    ).toBe(false);
  });
});

describe("isPlatformOwnerEmail", () => {
  it("matches allow-list case-insensitively", () => {
    expect(
      isPlatformOwnerEmail("Admin@Example.com", "admin@example.com, other@x.com"),
    ).toBe(true);
    expect(isPlatformOwnerEmail("member@example.com", "admin@example.com")).toBe(
      false,
    );
    expect(isPlatformOwnerEmail("admin@example.com", "")).toBe(false);
  });
});
