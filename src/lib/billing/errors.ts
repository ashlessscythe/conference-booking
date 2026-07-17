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
