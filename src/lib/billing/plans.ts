export const FREE_ROOM_LIMIT = 2;

/** Soft cap for Pro so a runaway script cannot create unbounded rooms. */
export const PRO_ROOM_LIMIT = 500;

export type PlanTierLike = "FREE" | "PRO";

export type BillingOrgSnapshot = {
  planTier: PlanTierLike;
  stripeSubscriptionStatus?: string | null;
  promoExpiresAt?: Date | null;
};

export function isActiveSubscriptionStatus(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

/**
 * Effective entitlement for room limits / feature gates.
 * Priority: active Stripe subscription → unexpired promo → stored Pro (seed/ops) → Free.
 * Expired promo windows never grant Pro even if `planTier` is still PRO.
 */
export function resolveEffectivePlan(
  org: BillingOrgSnapshot,
  now: Date = new Date(),
): PlanTierLike {
  if (isActiveSubscriptionStatus(org.stripeSubscriptionStatus)) {
    return "PRO";
  }
  if (org.promoExpiresAt && org.promoExpiresAt.getTime() > now.getTime()) {
    return "PRO";
  }
  if (org.promoExpiresAt && org.promoExpiresAt.getTime() <= now.getTime()) {
    return "FREE";
  }
  return org.planTier === "PRO" ? "PRO" : "FREE";
}

export function roomLimitForPlan(planTier: PlanTierLike): number {
  return planTier === "PRO" ? PRO_ROOM_LIMIT : FREE_ROOM_LIMIT;
}

export function canCreateRoom(input: {
  planTier: PlanTierLike;
  currentRoomCount: number;
}): boolean {
  return input.currentRoomCount < roomLimitForPlan(input.planTier);
}

export function canCreateRoomForOrg(
  org: BillingOrgSnapshot & { currentRoomCount: number },
  now: Date = new Date(),
): boolean {
  return canCreateRoom({
    planTier: resolveEffectivePlan(org, now),
    currentRoomCount: org.currentRoomCount,
  });
}

export function planLabel(planTier: PlanTierLike): string {
  return planTier === "PRO" ? "Pro" : "Free";
}

/** After Stripe cancel/delete: keep Pro if promo window still open. */
export function planAfterSubscriptionRemoved(
  org: Pick<BillingOrgSnapshot, "promoExpiresAt">,
  now: Date = new Date(),
): PlanTierLike {
  if (org.promoExpiresAt && org.promoExpiresAt.getTime() > now.getTime()) {
    return "PRO";
  }
  return "FREE";
}
