import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRoomBySlug, getRoomDaySchedule } from "@/features/rooms/queries";
import { isSampleRoomSlug } from "@/features/rooms/sample-data";
import { BookingForm } from "@/features/bookings/components/booking-form";
import { getBookingIntent } from "@/lib/booking-intent";
import {
  FREE_ROOM_LIMIT,
  FREE_USER_LIMIT,
  resolveEffectivePlan,
} from "@/lib/billing/plans";

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

  // Resume preserved booking after magic link (cookie writes need a Route Handler).
  if (
    session?.user &&
    intent?.roomSlug === room.slug &&
    intent.startAt &&
    intent.endAt
  ) {
    redirect(`/rooms/${slug}/book/resume`);
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
        {resolveEffectivePlan(room.organization) === "FREE" && (
          <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
            This workspace is on the free plan (up to {FREE_ROOM_LIMIT} rooms,{" "}
            {FREE_USER_LIMIT} users, fixed 30-minute meetings). Admins can
            upgrade to Pro for unlimited rooms and users, 15-minute scheduling,
            and custom meeting lengths.
          </p>
        )}
      </div>
      <BookingForm
        roomId={room.id}
        roomSlug={room.slug}
        schedule={schedule}
        authed={!!session?.user}
        defaultTitle={intent?.title || q.title}
        planTier={resolveEffectivePlan(room.organization)}
      />
    </div>
  );
}
