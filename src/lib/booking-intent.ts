import { cookies } from "next/headers";

export const BOOKING_INTENT_COOKIE = "booking_intent";

export type BookingIntent = {
  roomSlug: string;
  startAt?: string;
  endAt?: string;
  title?: string;
  returnTo: string;
};

export async function setBookingIntent(intent: BookingIntent) {
  const store = await cookies();
  store.set(BOOKING_INTENT_COOKIE, JSON.stringify(intent), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 30,
  });
}

export async function getBookingIntent(): Promise<BookingIntent | null> {
  const store = await cookies();
  const raw = store.get(BOOKING_INTENT_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BookingIntent;
  } catch {
    return null;
  }
}

export async function clearBookingIntent() {
  const store = await cookies();
  store.delete(BOOKING_INTENT_COOKIE);
}
