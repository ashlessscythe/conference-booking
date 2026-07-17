export const FREE_ROOM_LIMIT = 4;

/** Soft cap for Pro so a runaway script cannot create unbounded rooms. */
export const PRO_ROOM_LIMIT = 500;

/** Free orgs: accepted members + pending invites count toward this seat limit. */
export const FREE_USER_LIMIT = 2;

/** Soft seat cap for Pro (presented as unlimited in marketing). */
export const PRO_USER_LIMIT = 10_000;

export const FREE_BOOKING_STEP_MIN = 30;
export const PRO_BOOKING_STEP_MIN = 15;
export const FREE_BOOKING_DURATION_MIN = 30;
export const PRO_MIN_BOOKING_DURATION_MIN = 15;

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

export function userLimitForPlan(planTier: PlanTierLike): number {
  return planTier === "PRO" ? PRO_USER_LIMIT : FREE_USER_LIMIT;
}

export function bookingStepMinutesForPlan(planTier: PlanTierLike): number {
  return planTier === "PRO" ? PRO_BOOKING_STEP_MIN : FREE_BOOKING_STEP_MIN;
}

export function minBookingDurationMinutesForPlan(
  planTier: PlanTierLike,
): number {
  return planTier === "PRO"
    ? PRO_MIN_BOOKING_DURATION_MIN
    : FREE_BOOKING_DURATION_MIN;
}

/** Free: fixed 30-minute meetings. Pro: custom lengths in 15-minute steps. */
export function allowsCustomMeetingLength(planTier: PlanTierLike): boolean {
  return planTier === "PRO";
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

/**
 * Seat usage = accepted members + unexpired, unaccepted invitations.
 * Re-inviting an existing pending email or updating an existing member does not
 * consume an extra seat.
 */
export function canAddSeat(input: {
  planTier: PlanTierLike;
  currentSeatCount: number;
}): boolean {
  return input.currentSeatCount < userLimitForPlan(input.planTier);
}

export function canAddSeatForOrg(
  org: BillingOrgSnapshot & { currentSeatCount: number },
  now: Date = new Date(),
): boolean {
  return canAddSeat({
    planTier: resolveEffectivePlan(org, now),
    currentSeatCount: org.currentSeatCount,
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

function isAlignedToStep(date: Date, stepMin: number): boolean {
  if (date.getSeconds() !== 0 || date.getMilliseconds() !== 0) {
    return false;
  }
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes % stepMin === 0;
}

/**
 * Validates booking start/end against plan entitlements.
 * Free: exactly 30 minutes, snapped to 30-minute boundaries.
 * Pro: at least 15 minutes, snapped to 15-minute boundaries.
 */
export function assertBookingFitsPlan(input: {
  planTier: PlanTierLike;
  startAt: Date;
  endAt: Date;
}): void {
  const { planTier, startAt, endAt } = input;
  const durationMin = (endAt.getTime() - startAt.getTime()) / 60_000;
  const step = bookingStepMinutesForPlan(planTier);
  const minDuration = minBookingDurationMinutesForPlan(planTier);

  if (!(durationMin > 0)) {
    throw new Error("End time must be after start time.");
  }

  if (!isAlignedToStep(startAt, step) || !isAlignedToStep(endAt, step)) {
    throw new Error(
      planTier === "FREE"
        ? "Free plan bookings must start and end on the half hour."
        : "Pro bookings must start and end on a 15-minute boundary.",
    );
  }

  if (planTier === "FREE") {
    if (durationMin !== FREE_BOOKING_DURATION_MIN) {
      throw new Error(
        "Free plan meetings are fixed at 30 minutes. Upgrade to Pro for custom lengths.",
      );
    }
    return;
  }

  if (durationMin < minDuration) {
    throw new Error(`Meetings must be at least ${minDuration} minutes long.`);
  }

  if (durationMin % step !== 0) {
    throw new Error(`Meeting length must be a multiple of ${step} minutes.`);
  }
}
