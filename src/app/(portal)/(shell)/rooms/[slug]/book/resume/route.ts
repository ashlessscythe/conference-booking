import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRoomBySlug } from "@/features/rooms/queries";
import { isSampleRoomSlug } from "@/features/rooms/sample-data";
import {
  clearBookingIntent,
  getBookingIntent,
} from "@/lib/booking-intent";
import { createBooking } from "@/features/bookings/actions";

/**
 * Resume a preserved booking after magic-link sign-in.
 * Cookie clears must run in a Route Handler, not during RSC render.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  if (isSampleRoomSlug(slug)) {
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${encodeURIComponent("/rooms")}`, _request.url),
    );
  }

  const room = await getRoomBySlug(slug);
  if (!room) {
    return NextResponse.redirect(new URL("/rooms", _request.url));
  }

  const session = await auth();
  const intent = await getBookingIntent();

  if (
    session?.user &&
    intent?.roomSlug === room.slug &&
    intent.startAt &&
    intent.endAt
  ) {
    try {
      await createBooking({
        roomId: room.id,
        title: intent.title || "Meeting",
        startAt: new Date(intent.startAt),
        endAt: new Date(intent.endAt),
      });
    } catch {
      await clearBookingIntent();
      return NextResponse.redirect(
        new URL(`/rooms/${slug}/book`, _request.url),
      );
    }
    return NextResponse.redirect(new URL("/bookings", _request.url));
  }

  return NextResponse.redirect(new URL(`/rooms/${slug}/book`, _request.url));
}
