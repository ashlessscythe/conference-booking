import type { ReactNode } from "react";
import Link from "next/link";
import {
  getDashboardSnapshot,
  getDefaultOrganizationId,
} from "@/features/rooms/queries";
import { StatusBadge } from "@/features/rooms/components/status-badge";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { LocalTime } from "@/components/local-time";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ capacity?: string; q?: string }>;
}) {
  const params = await searchParams;
  const orgId = await getDefaultOrganizationId();

  if (!orgId) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">Conference Booking</h1>
        <p className="text-muted-foreground">
          No organization seeded yet. Run{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">npm run db:seed</code>.
        </p>
      </div>
    );
  }

  const snap = await getDashboardSnapshot(orgId);
  const capacity = params.capacity ? Number(params.capacity) : null;
  const q = (params.q ?? "").toLowerCase().trim();

  let rooms = snap.rooms;
  if (capacity) rooms = rooms.filter((r) => r.capacity >= capacity);
  if (q) {
    rooms = rooms.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.floor ?? "").toLowerCase().includes(q),
    );
  }

  const firstFree = snap.freeNow[0];

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">
              Room status
            </h1>
            <p className="mt-2 max-w-xl text-lg text-muted-foreground">
              See what&apos;s free, what&apos;s happening now, and book in a few
              taps.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {firstFree && (
              <LinkButton
                href={`/rooms/${firstFree.slug}/book`}
                size="lg"
                className="h-12"
              >
                Book available room
              </LinkButton>
            )}
            <LinkButton href="/rooms?capacity=8" size="lg" variant="outline" className="h-12">
              Find 8+ seats
            </LinkButton>
            <LinkButton href="/rooms#schedule" size="lg" variant="outline" className="h-12">
              View floor schedule
            </LinkButton>
          </div>
        </div>

        <form className="flex flex-col gap-2 sm:flex-row">
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Search rooms"
            className="h-12 flex-1 rounded-lg border bg-background px-4 text-base"
            aria-label="Search rooms"
          />
          <input
            name="capacity"
            type="number"
            min={1}
            defaultValue={params.capacity}
            placeholder="Min capacity"
            className="h-12 w-full rounded-lg border bg-background px-4 text-base sm:w-40"
            aria-label="Minimum capacity"
          />
          <Button type="submit" className="h-12">
            Search
          </Button>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Free now"
          value={String(snap.freeNow.length)}
          hint={snap.freeNow.map((r) => r.name).join(", ") || "None"}
        />
        <SummaryCard
          title="Free soon"
          value={String(snap.freeSoon.length)}
          hint="Ending or starting shortly"
        />
        <SummaryCard
          title="Happening now"
          value={String(snap.happeningNow.length)}
          hint={
            snap.happeningNow[0]
              ? `${snap.happeningNow[0].booking.title} · ${snap.happeningNow[0].room.name}`
              : "Quiet right now"
          }
        />
        <SummaryCard
          title="Up next"
          value={String(snap.nextMeetings.length)}
          hint={
            snap.nextMeetings[0] ? (
              <>
                <LocalTime
                  value={snap.nextMeetings[0].booking.startAt}
                  pattern="h:mm a"
                />{" "}
                · {snap.nextMeetings[0].room.name}
              </>
            ) : (
              "Nothing scheduled"
            )
          }
        />
      </section>

      <section id="schedule" className="space-y-4">
        <h2 className="text-2xl font-semibold">All rooms</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {rooms.map((room) => (
            <Card key={room.id} className="overflow-hidden">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-xl">
                    <Link
                      href={`/rooms/${room.slug}`}
                      className="hover:underline"
                    >
                      {room.name}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    {room.capacity} seats
                    {room.floor ? ` · Floor ${room.floor}` : ""}
                  </CardDescription>
                </div>
                <StatusBadge status={room.status.key} />
              </CardHeader>
              <CardContent className="space-y-3">
                {room.status.current ? (
                  <p>
                    <span className="font-medium">Now:</span>{" "}
                    {room.status.current.title}
                    {room.status.minutesRemaining != null &&
                      ` · ${room.status.minutesRemaining}m left`}
                  </p>
                ) : room.status.next ? (
                  <p>
                    <span className="font-medium">Next:</span>{" "}
                    {room.status.next.title} at{" "}
                    <LocalTime value={room.status.next.startAt} pattern="h:mm a" />
                  </p>
                ) : (
                  <p className="text-muted-foreground">Open for the rest of today</p>
                )}
                <LinkButton
                  href={`/rooms/${room.slug}/book`}
                  className="h-11 w-full sm:w-auto"
                >
                  Book
                </LinkButton>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-4xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="line-clamp-2 text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
