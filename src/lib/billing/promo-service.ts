import { prisma } from "@/lib/db";
import {
  getStripe,
  isStripeCheckoutConfigured,
} from "@/lib/billing/stripe";
import {
  normalizePromoCode,
  validateCreatePromo,
  validatePromoForRedeem,
  type CreatePromoInput,
  type PromoCodeRecord,
} from "@/lib/billing/promo";
import { PromoRedeemError } from "@/lib/billing/errors";

function toPromoRecord(row: {
  id: string;
  code: string;
  kind: PromoCodeRecord["kind"];
  active: boolean;
  freeMonths: number | null;
  percentOff: number | null;
  amountOffCents: number | null;
  durationMonths: number | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  expiresAt: Date | null;
  stripePromotionCodeId: string | null;
}): PromoCodeRecord {
  return row;
}

async function syncStripePromotion(input: {
  code: string;
  kind: CreatePromoInput["kind"];
  freeMonths?: number | null;
  percentOff?: number | null;
  amountOffCents?: number | null;
  durationMonths?: number | null;
  maxRedemptions?: number | null;
  expiresAt?: Date | null;
}): Promise<{ couponId: string; promotionCodeId: string } | null> {
  if (!isStripeCheckoutConfigured()) return null;

  const stripe = getStripe();
  let couponParams: Parameters<typeof stripe.coupons.create>[0];

  if (input.kind === "FREE_MONTHS") {
    const months = input.freeMonths ?? 1;
    couponParams = {
      percent_off: 100,
      duration: "repeating",
      duration_in_months: months,
      name: `Promo ${input.code} (${months} mo free)`,
    };
  } else if (input.kind === "PERCENT_OFF") {
    const months = input.durationMonths;
    couponParams = {
      percent_off: input.percentOff ?? undefined,
      duration: months ? "repeating" : "once",
      ...(months ? { duration_in_months: months } : {}),
      name: `Promo ${input.code}`,
    };
  } else {
    const months = input.durationMonths;
    couponParams = {
      amount_off: input.amountOffCents ?? undefined,
      currency: "usd",
      duration: months ? "repeating" : "once",
      ...(months ? { duration_in_months: months } : {}),
      name: `Promo ${input.code}`,
    };
  }

  const coupon = await stripe.coupons.create(couponParams);
  const promotion = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id },
    code: input.code,
    max_redemptions: input.maxRedemptions ?? undefined,
    expires_at: input.expiresAt
      ? Math.floor(input.expiresAt.getTime() / 1000)
      : undefined,
  });

  return { couponId: coupon.id, promotionCodeId: promotion.id };
}

export async function createPromoCodeRecord(
  input: CreatePromoInput & { createdByUserId: string },
) {
  const validated = validateCreatePromo(input);
  if (!validated.ok) {
    throw new Error(validated.message);
  }

  const existing = await prisma.promoCode.findUnique({
    where: { code: validated.code },
  });
  if (existing) {
    throw new Error("That promo code already exists.");
  }

  let stripeCouponId: string | null = null;
  let stripePromotionCodeId: string | null = null;

  if (validated.data.kind !== "FREE_MONTHS" && !isStripeCheckoutConfigured()) {
    throw new Error(
      "Configure Stripe (STRIPE_SECRET_KEY + STRIPE_PRICE_ID) before creating discount promos.",
    );
  }

  if (isStripeCheckoutConfigured()) {
    try {
      const synced = await syncStripePromotion(validated.data);
      if (synced) {
        stripeCouponId = synced.couponId;
        stripePromotionCodeId = synced.promotionCodeId;
      }
    } catch (err) {
      console.error("Failed to sync promo to Stripe:", err);
      if (validated.data.kind !== "FREE_MONTHS") {
        throw new Error(
          "Could not create Stripe coupon/promotion code. Check Stripe keys and try again.",
        );
      }
    }
  }

  return prisma.promoCode.create({
    data: {
      code: validated.data.code,
      kind: validated.data.kind,
      freeMonths: validated.data.freeMonths,
      percentOff: validated.data.percentOff,
      amountOffCents: validated.data.amountOffCents,
      durationMonths: validated.data.durationMonths,
      maxRedemptions: validated.data.maxRedemptions,
      expiresAt: validated.data.expiresAt,
      note: validated.data.note,
      createdByUserId: input.createdByUserId,
      stripeCouponId,
      stripePromotionCodeId,
    },
  });
}

export async function redeemPromoCodeForOrganization(input: {
  code: string;
  organizationId: string;
  userId: string;
  now?: Date;
}) {
  const code = normalizePromoCode(input.code);
  const now = input.now ?? new Date();

  const promo = await prisma.promoCode.findUnique({ where: { code } });
  const already = promo
    ? await prisma.promoRedemption.findUnique({
        where: {
          promoCodeId_organizationId: {
            promoCodeId: promo.id,
            organizationId: input.organizationId,
          },
        },
      })
    : null;

  const result = validatePromoForRedeem({
    promo: promo ? toPromoRecord(promo) : null,
    organizationId: input.organizationId,
    alreadyRedeemedByOrg: Boolean(already),
    now,
  });

  if (!result.ok) {
    throw new PromoRedeemError(result.message);
  }

  await prisma.$transaction(async (tx) => {
    // Re-check max redemptions inside the transaction
    const locked = await tx.promoCode.findUniqueOrThrow({
      where: { id: promo!.id },
    });
    if (
      locked.maxRedemptions != null &&
      locked.redemptionCount >= locked.maxRedemptions
    ) {
      throw new PromoRedeemError(
        "This promo code has reached its redemption limit.",
      );
    }

    await tx.promoRedemption.create({
      data: {
        promoCodeId: locked.id,
        organizationId: input.organizationId,
        redeemedById: input.userId,
      },
    });

    await tx.promoCode.update({
      where: { id: locked.id },
      data: { redemptionCount: { increment: 1 } },
    });

    if (result.kind === "FREE_MONTHS" && result.promoExpiresAt) {
      await tx.organization.update({
        where: { id: input.organizationId },
        data: {
          planTier: "PRO",
          promoExpiresAt: result.promoExpiresAt,
          // Also stash Stripe promo so Checkout can still apply 100% off if they add a card
          pendingStripePromotionCodeId:
            result.stripePromotionCodeId ?? undefined,
        },
      });
    } else {
      await tx.organization.update({
        where: { id: input.organizationId },
        data: {
          pendingStripePromotionCodeId:
            result.stripePromotionCodeId ?? undefined,
        },
      });
    }
  });

  return result;
}

/** Downgrade orgs whose promo window ended and who have no active Stripe sub. */
export async function expireStalePromoGrants(now = new Date()) {
  const stale = await prisma.organization.findMany({
    where: {
      promoExpiresAt: { lte: now },
      OR: [
        { stripeSubscriptionStatus: null },
        { stripeSubscriptionStatus: { notIn: ["active", "trialing"] } },
      ],
    },
    select: { id: true },
  });

  if (stale.length === 0) return 0;

  await prisma.organization.updateMany({
    where: { id: { in: stale.map((o) => o.id) } },
    data: {
      planTier: "FREE",
      promoExpiresAt: null,
    },
  });

  return stale.length;
}
