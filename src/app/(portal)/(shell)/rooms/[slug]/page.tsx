import { notFound } from "next/navigation";
import { getRoomBySlug, getRoomDaySchedule } from "@/features/rooms/queries";
import {
  getSampleRoomBySlug,
  getSampleRoomDaySchedule,
  isSampleRoomSlug,
  sampleStatusNow,
} from "@/features/rooms/sample-data";
import {
  DEFAULT_CLEANING_BUFFER_MIN,
  DEFAULT_STARTING_SOON_MIN,
  deriveRoomStatus,
} from "@/lib/room-status";
import { getOrgSettings } from "@/lib/session";
import { StatusBadge } from "@/features/rooms/components/status-badge";
import { DayTimeline } from "@/features/bookings/components/day-timeline";
import { LinkButton } from "@/components/link-button";
import { LocalTime } from "@/components/local-time";
import { resolveEffectivePlan } from "@/lib/billing/plans";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { slug } = await params;
  const q = await searchParams;

  if (isSampleRoomSlug(slug)) {
    return <SampleRoomPage slug={slug} />;
  }

  const room = await getRoomBySlug(slug);
  if (!room) notFound();

  if (q.v && Number(q.v) !== room.qrVersion) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">QR code expired</h1>
        <p className="text-muted-foreground">
          This printed code was regenerated. Ask facilities for the latest QR,
          or open the room from the rooms list.
        </p>
        <LinkButton href="/rooms">Go to rooms</LinkButton>
      </div>
    );
  }

  const settings = await getOrgSettings(room.organizationId);
  const status = deriveRoomStatus({
    outOfService: room.outOfService,
    bookings: room.bookings,
    cleaningBufferMin: settings.cleaningBufferMin,
    startingSoonMin: settings.startingSoonMin,
  });
  const schedule = await getRoomDaySchedule(room.id);

  return (
    <RoomDetail
      name={room.name}
      capacity={room.capacity}
      floor={room.floor}
      description={room.description}
      outOfService={room.outOfService}
      status={status}
      schedule={schedule.map((b) => ({
        id: b.id,
        title: b.title,
        startAt: b.startAt,
        endAt: b.endAt,
        organizer: b.organizer.name ?? b.organizer.email,
      }))}
      bookHref={`/rooms/${room.slug}/book`}
      bookLabel="Book room"
      planTier={resolveEffectivePlan(room.organization)}
    />
  );
}

function SampleRoomPage({ slug }: { slug: string }) {
  const room = getSampleRoomBySlug(slug);
  if (!room) notFound();

  const schedule = getSampleRoomDaySchedule(slug);
  const status = deriveRoomStatus({
    outOfService: room.outOfService,
    now: sampleStatusNow(),
    bookings: schedule,
    cleaningBufferMin: DEFAULT_CLEANING_BUFFER_MIN,
    startingSoonMin: DEFAULT_STARTING_SOON_MIN,
  });

  return (
    <RoomDetail
      name={room.name}
      capacity={room.capacity}
      floor={room.floor}
      description={`${room.description} · Sample preview`}
      outOfService={room.outOfService}
      status={status}
      schedule={schedule.map((b) => ({
        id: b.id,
        title: b.title,
        startAt: b.startAt,
        endAt: b.endAt,
        organizer: b.organizer?.name ?? b.organizer?.email ?? null,
      }))}
      bookHref={`/login?callbackUrl=${encodeURIComponent("/rooms")}`}
      bookLabel="Sign in to book"
    />
  );
}

function RoomDetail({
  name,
  capacity,
  floor,
  description,
  outOfService,
  status,
  schedule,
  bookHref,
  bookLabel,
  planTier,
}: {
  name: string;
  capacity: number;
  floor: string | null;
  description: string | null;
  outOfService: boolean;
  status: ReturnType<typeof deriveRoomStatus>;
  schedule: {
    id: string;
    title: string;
    startAt: Date;
    endAt: Date;
    organizer?: string | null;
  }[];
  bookHref: string;
  bookLabel: string;
  planTier?: "FREE" | "PRO";
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <StatusBadge status={status.key} large />
          <h1 className="text-4xl font-semibold tracking-tight">{name}</h1>
          <p className="text-lg text-muted-foreground">
            {capacity} seats
            {floor ? ` · Floor ${floor}` : ""}
            {description ? ` · ${description}` : ""}
          </p>
        </div>
        <LinkButton href={bookHref} size="lg" className="h-14 min-w-48 text-lg">
          {bookLabel}
        </LinkButton>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Available now?</CardDescription>
            <CardTitle className="text-2xl">
              {status.key === "AVAILABLE" || status.key === "STARTING_SOON"
                ? "Yes"
                : "No"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>What&apos;s next?</CardDescription>
            <CardTitle className="text-xl">
              {status.current ? (
                `${status.current.title} (now)`
              ) : status.next ? (
                <>
                  {status.next.title} ·{" "}
                  <LocalTime value={status.next.startAt} pattern="h:mm a" />
                </>
              ) : (
                "Open rest of day"
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Can I book?</CardDescription>
            <CardTitle className="text-2xl">
              {outOfService ? "Not today" : "Yes"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s schedule</CardTitle>
          <CardDescription>Visual blocks — red means booked.</CardDescription>
        </CardHeader>
        <CardContent>
          <DayTimeline bookings={schedule} planTier={planTier} />
        </CardContent>
      </Card>
    </div>
  );
}
