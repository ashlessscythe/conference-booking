export const DEFAULT_CLEANING_BUFFER_MIN = 10;
export const DEFAULT_STARTING_SOON_MIN = 15;
export const DEFAULT_HEARTBEAT_TIMEOUT_MIN = 5;

export type RoomStatusKey =
  | "AVAILABLE"
  | "OCCUPIED"
  | "STARTING_SOON"
  | "CLEANING_BUFFER"
  | "OUT_OF_SERVICE"
  | "RESERVED";

export const ROOM_STATUS_META: Record<
  RoomStatusKey,
  { label: string; color: string; bg: string; text: string; border: string }
> = {
  AVAILABLE: {
    label: "Available",
    color: "#15803d",
    bg: "bg-emerald-600",
    text: "text-emerald-50",
    border: "border-emerald-700",
  },
  OCCUPIED: {
    label: "Occupied",
    color: "#b91c1c",
    bg: "bg-red-700",
    text: "text-red-50",
    border: "border-red-800",
  },
  STARTING_SOON: {
    label: "Starting Soon",
    color: "#c2410c",
    bg: "bg-orange-600",
    text: "text-orange-50",
    border: "border-orange-700",
  },
  CLEANING_BUFFER: {
    label: "Cleaning Buffer",
    color: "#a16207",
    bg: "bg-amber-600",
    text: "text-amber-50",
    border: "border-amber-700",
  },
  OUT_OF_SERVICE: {
    label: "Out of Service",
    color: "#525252",
    bg: "bg-neutral-600",
    text: "text-neutral-50",
    border: "border-neutral-700",
  },
  RESERVED: {
    label: "Reserved",
    color: "#1d4ed8",
    bg: "bg-blue-700",
    text: "text-blue-50",
    border: "border-blue-800",
  },
};

export type BookingLike = {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  status: string;
  organizer?: { name: string | null; email: string } | null;
};

export type DerivedRoomStatus = {
  key: RoomStatusKey;
  label: string;
  current: BookingLike | null;
  next: BookingLike | null;
  freeAt: Date | null;
  minutesRemaining: number | null;
};

function activeBookings(bookings: BookingLike[]): BookingLike[] {
  return bookings
    .filter((b) => b.status === "CONFIRMED")
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

export function deriveRoomStatus(input: {
  outOfService: boolean;
  now?: Date;
  bookings: BookingLike[];
  cleaningBufferMin?: number;
  startingSoonMin?: number;
}): DerivedRoomStatus {
  const now = input.now ?? new Date();
  const bufferMs = (input.cleaningBufferMin ?? DEFAULT_CLEANING_BUFFER_MIN) * 60_000;
  const soonMs = (input.startingSoonMin ?? DEFAULT_STARTING_SOON_MIN) * 60_000;
  const bookings = activeBookings(input.bookings);

  if (input.outOfService) {
    return {
      key: "OUT_OF_SERVICE",
      label: ROOM_STATUS_META.OUT_OF_SERVICE.label,
      current: null,
      next: bookings.find((b) => b.endAt > now) ?? null,
      freeAt: null,
      minutesRemaining: null,
    };
  }

  const current =
    bookings.find((b) => b.startAt <= now && b.endAt > now) ?? null;

  if (current) {
    const minutesRemaining = Math.max(
      0,
      Math.ceil((current.endAt.getTime() - now.getTime()) / 60_000),
    );
    const next =
      bookings.find((b) => b.startAt >= current.endAt) ?? null;
    return {
      key: "OCCUPIED",
      label: ROOM_STATUS_META.OCCUPIED.label,
      current,
      next,
      freeAt: current.endAt,
      minutesRemaining,
    };
  }

  const justEnded = [...bookings]
    .reverse()
    .find((b) => b.endAt <= now && now.getTime() - b.endAt.getTime() < bufferMs);

  if (justEnded) {
    const freeAt = new Date(justEnded.endAt.getTime() + bufferMs);
    const next = bookings.find((b) => b.startAt > now) ?? null;
    return {
      key: "CLEANING_BUFFER",
      label: ROOM_STATUS_META.CLEANING_BUFFER.label,
      current: null,
      next,
      freeAt,
      minutesRemaining: Math.max(
        0,
        Math.ceil((freeAt.getTime() - now.getTime()) / 60_000),
      ),
    };
  }

  const next = bookings.find((b) => b.startAt > now) ?? null;

  if (next && next.startAt.getTime() - now.getTime() <= soonMs) {
    return {
      key: "STARTING_SOON",
      label: ROOM_STATUS_META.STARTING_SOON.label,
      current: null,
      next,
      freeAt: null,
      minutesRemaining: Math.max(
        0,
        Math.ceil((next.startAt.getTime() - now.getTime()) / 60_000),
      ),
    };
  }

  if (next) {
    // Future booking exists but not imminent — still available now
    return {
      key: "AVAILABLE",
      label: ROOM_STATUS_META.AVAILABLE.label,
      current: null,
      next,
      freeAt: null,
      minutesRemaining: null,
    };
  }

  return {
    key: "AVAILABLE",
    label: ROOM_STATUS_META.AVAILABLE.label,
    current: null,
    next: null,
    freeAt: null,
    minutesRemaining: null,
  };
}

export function isBookableNow(status: DerivedRoomStatus): boolean {
  return status.key === "AVAILABLE" || status.key === "STARTING_SOON";
}
