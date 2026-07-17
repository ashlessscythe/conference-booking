export const FREE_ROOM_LIMIT = 2;

/** Soft cap for Pro so a runaway script cannot create unbounded rooms. */
export const PRO_ROOM_LIMIT = 500;

export type PlanTierLike = "FREE" | "PRO";

export function roomLimitForPlan(planTier: PlanTierLike): number {
  return planTier === "PRO" ? PRO_ROOM_LIMIT : FREE_ROOM_LIMIT;
}

export function canCreateRoom(input: {
  planTier: PlanTierLike;
  currentRoomCount: number;
}): boolean {
  return input.currentRoomCount < roomLimitForPlan(input.planTier);
}

export function planLabel(planTier: PlanTierLike): string {
  return planTier === "PRO" ? "Pro" : "Free";
}
