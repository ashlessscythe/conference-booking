export type PromoKind = "FREE_MONTHS" | "PERCENT_OFF" | "AMOUNT_OFF";

export type PromoCodeRecord = {
  id: string;
  code: string;
  kind: PromoKind;
  active: boolean;
  freeMonths: number | null;
  percentOff: number | null;
  amountOffCents: number | null;
  durationMonths: number | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  expiresAt: Date | null;
  stripePromotionCodeId: string | null;
};

export type RedeemPromoInput = {
  promo: PromoCodeRecord | null;
  organizationId: string;
  alreadyRedeemedByOrg: boolean;
  now?: Date;
};

export type RedeemPromoSuccess = {
  ok: true;
  kind: PromoKind;
  /** Pro access until this date (FREE_MONTHS). */
  promoExpiresAt: Date | null;
  /** Stripe promotion code to attach at Checkout when present. */
  stripePromotionCodeId: string | null;
  percentOff: number | null;
  amountOffCents: number | null;
  durationMonths: number | null;
  freeMonths: number | null;
  message: string;
};

export type RedeemPromoFailure = {
  ok: false;
  code:
    | "NOT_FOUND"
    | "INACTIVE"
    | "EXPIRED"
    | "MAX_REDEMPTIONS"
    | "ALREADY_REDEEMED"
    | "INVALID_CONFIG";
  message: string;
};

export type RedeemPromoResult = RedeemPromoSuccess | RedeemPromoFailure;

export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Clamp overflow (Jan 31 + 1 month → Mar 3 in some engines); restore day when possible
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
}

export function validatePromoForRedeem(
  input: RedeemPromoInput,
): RedeemPromoResult {
  const now = input.now ?? new Date();
  const promo = input.promo;

  if (!promo) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "That promo code was not found.",
    };
  }
  if (!promo.active) {
    return {
      ok: false,
      code: "INACTIVE",
      message: "This promo code is no longer active.",
    };
  }
  if (promo.expiresAt && promo.expiresAt.getTime() <= now.getTime()) {
    return {
      ok: false,
      code: "EXPIRED",
      message: "This promo code has expired.",
    };
  }
  if (
    promo.maxRedemptions != null &&
    promo.redemptionCount >= promo.maxRedemptions
  ) {
    return {
      ok: false,
      code: "MAX_REDEMPTIONS",
      message: "This promo code has reached its redemption limit.",
    };
  }
  if (input.alreadyRedeemedByOrg) {
    return {
      ok: false,
      code: "ALREADY_REDEEMED",
      message: "Your organization already redeemed this promo code.",
    };
  }

  if (promo.kind === "FREE_MONTHS") {
    const months = promo.freeMonths ?? 0;
    if (!Number.isInteger(months) || months < 1 || months > 36) {
      return {
        ok: false,
        code: "INVALID_CONFIG",
        message: "This promo is misconfigured (free months).",
      };
    }
    const promoExpiresAt = addMonths(now, months);
    return {
      ok: true,
      kind: "FREE_MONTHS",
      promoExpiresAt,
      stripePromotionCodeId: promo.stripePromotionCodeId,
      percentOff: null,
      amountOffCents: null,
      durationMonths: months,
      freeMonths: months,
      message: `Pro unlocked for ${months} month${months === 1 ? "" : "s"}.`,
    };
  }

  if (promo.kind === "PERCENT_OFF") {
    const pct = promo.percentOff ?? 0;
    if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
      return {
        ok: false,
        code: "INVALID_CONFIG",
        message: "This promo is misconfigured (percent off).",
      };
    }
    return {
      ok: true,
      kind: "PERCENT_OFF",
      promoExpiresAt: null,
      stripePromotionCodeId: promo.stripePromotionCodeId,
      percentOff: pct,
      amountOffCents: null,
      durationMonths: promo.durationMonths,
      freeMonths: null,
      message: `${pct}% off will apply at checkout${
        promo.durationMonths ? ` for ${promo.durationMonths} month(s)` : ""
      }.`,
    };
  }

  // AMOUNT_OFF
  const amount = promo.amountOffCents ?? 0;
  if (!Number.isInteger(amount) || amount < 1) {
    return {
      ok: false,
      code: "INVALID_CONFIG",
      message: "This promo is misconfigured (amount off).",
    };
  }
  return {
    ok: true,
    kind: "AMOUNT_OFF",
    promoExpiresAt: null,
    stripePromotionCodeId: promo.stripePromotionCodeId,
    percentOff: null,
    amountOffCents: amount,
    durationMonths: promo.durationMonths,
    freeMonths: null,
    message: `$${(amount / 100).toFixed(2)} off will apply at checkout.`,
  };
}

export type CreatePromoInput = {
  code: string;
  kind: PromoKind;
  freeMonths?: number | null;
  percentOff?: number | null;
  amountOffCents?: number | null;
  durationMonths?: number | null;
  maxRedemptions?: number | null;
  expiresAt?: Date | null;
  note?: string | null;
};

export type CreatePromoValidation =
  | { ok: true; code: string; data: Required<Omit<CreatePromoInput, "note">> & { note: string | null } }
  | { ok: false; message: string };

export function validateCreatePromo(raw: CreatePromoInput): CreatePromoValidation {
  const code = normalizePromoCode(raw.code);
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return {
      ok: false,
      message: "Code must be 3–32 chars: letters, numbers, _ or -.",
    };
  }

  if (raw.kind === "FREE_MONTHS") {
    const freeMonths = Number(raw.freeMonths);
    if (!Number.isInteger(freeMonths) || freeMonths < 1 || freeMonths > 36) {
      return { ok: false, message: "Free months must be an integer 1–36." };
    }
    return {
      ok: true,
      code,
      data: {
        code,
        kind: "FREE_MONTHS",
        freeMonths,
        percentOff: null,
        amountOffCents: null,
        durationMonths: freeMonths,
        maxRedemptions: raw.maxRedemptions ?? null,
        expiresAt: raw.expiresAt ?? null,
        note: raw.note ?? null,
      },
    };
  }

  if (raw.kind === "PERCENT_OFF") {
    const percentOff = Number(raw.percentOff);
    if (!Number.isInteger(percentOff) || percentOff < 1 || percentOff > 100) {
      return { ok: false, message: "Percent off must be an integer 1–100." };
    }
    const durationMonths =
      raw.durationMonths == null || raw.durationMonths === 0
        ? null
        : Number(raw.durationMonths);
    if (
      durationMonths != null &&
      (!Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 36)
    ) {
      return {
        ok: false,
        message: "Duration months must be empty or an integer 1–36.",
      };
    }
    return {
      ok: true,
      code,
      data: {
        code,
        kind: "PERCENT_OFF",
        freeMonths: null,
        percentOff,
        amountOffCents: null,
        durationMonths,
        maxRedemptions: raw.maxRedemptions ?? null,
        expiresAt: raw.expiresAt ?? null,
        note: raw.note ?? null,
      },
    };
  }

  const amountOffCents = Number(raw.amountOffCents);
  if (!Number.isInteger(amountOffCents) || amountOffCents < 1) {
    return {
      ok: false,
      message: "Amount off must be a positive integer (cents).",
    };
  }
  const durationMonths =
    raw.durationMonths == null || raw.durationMonths === 0
      ? null
      : Number(raw.durationMonths);
  if (
    durationMonths != null &&
    (!Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 36)
  ) {
    return {
      ok: false,
      message: "Duration months must be empty or an integer 1–36.",
    };
  }
  return {
    ok: true,
    code,
    data: {
      code,
      kind: "AMOUNT_OFF",
      freeMonths: null,
      percentOff: null,
      amountOffCents,
      durationMonths,
      maxRedemptions: raw.maxRedemptions ?? null,
      expiresAt: raw.expiresAt ?? null,
      note: raw.note ?? null,
    },
  };
}

export function isPlatformOwnerEmail(
  email: string | null | undefined,
  allowListRaw: string | undefined = process.env.PLATFORM_OWNER_EMAILS,
): boolean {
  if (!email) return false;
  const list = (allowListRaw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return false;
  return list.includes(email.trim().toLowerCase());
}
