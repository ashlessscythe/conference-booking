import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRoomBySlug, getRoomDaySchedule } from "@/features/rooms/queries";
import { isSampleRoomSlug } from "@/features/rooms/sample-data";
import { BookingForm } from "@/features/bookings/components/booking-form";
import {
  clearBookingIntent,
  getBookingIntent,
} from "@/lib/booking-intent";
import { createBooking } from "@/features/bookings/actions";

export const dynamic = "force-dynamic";

export default async function BookRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ title?: string }>;
}) {
  const { slug } = await params;
  const q = await searchParams;

  if (isSampleRoomSlug(slug)) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/rooms")}`);
  }

  const room = await getRoomBySlug(slug);
  if (!room) notFound();

  const session = await auth();
  const schedule = await getRoomDaySchedule(room.id);
  const intent = await getBookingIntent();

  // Resume preserved booking after magic link
  if (
    session?.user &&
    intent?.roomSlug === room.slug &&
    intent.startAt &&
    intent.endAt
  ) {
    try {
      await createBooking({
        roomId: room.id,
        title: intent.title || q.title || "Meeting",
        startAt: new Date(intent.startAt),
        endAt: new Date(intent.endAt),
      });
      await clearBookingIntent();
      redirect("/bookings");
    } catch {
      await clearBookingIntent();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Book {room.name}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Pick a free slot on the timeline. No long forms.
        </p>
        {room.organization.planTier === "FREE" && (
          <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
            This workspace is on the free plan (up to 2 rooms). Admins can
            upgrade to Pro when they need more rooms.
          </p>
        )}
      </div>
      <BookingForm
        roomId={room.id}
        roomSlug={room.slug}
        schedule={schedule}
        authed={!!session?.user}
        defaultTitle={intent?.title || q.title}
      />
    </div>
  );
}
