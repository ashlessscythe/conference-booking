export class RoomLimitError extends Error {
  constructor(
    message: string,
    public readonly limit: number,
    public readonly planTier: "FREE" | "PRO",
  ) {
    super(message);
    this.name = "RoomLimitError";
  }
}

export function isRoomLimitError(error: unknown): error is RoomLimitError {
  return error instanceof RoomLimitError ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name: string }).name === "RoomLimitError");
}

export class PromoRedeemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromoRedeemError";
  }
}

export function isPromoRedeemError(error: unknown): error is PromoRedeemError {
  return (
    error instanceof PromoRedeemError ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name: string }).name === "PromoRedeemError")
  );
}
