"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { createBooking } from "@/features/bookings/actions";
import { DayTimeline } from "@/features/bookings/components/day-timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlanTierLike } from "@/lib/billing/plans";
import { allowsCustomMeetingLength } from "@/lib/billing/plans";

type ScheduleItem = {
  id: string;
  title: string;
  startAt: Date | string;
  endAt: Date | string;
  organizer?: { name: string | null; email: string } | null;
};

export function BookingForm({
  roomId,
  roomSlug,
  schedule,
  authed,
  defaultTitle = "",
  planTier = "FREE",
}: {
  roomId: string;
  roomSlug: string;
  schedule: ScheduleItem[];
  authed: boolean;
  defaultTitle?: string;
  planTier?: PlanTierLike;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(defaultTitle || "Meeting");
  const [startAt, setStartAt] = useState<Date | null>(null);
  const [endAt, setEndAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const blocks = schedule.map((b) => ({
    id: b.id,
    title: b.title,
    startAt: new Date(b.startAt),
    endAt: new Date(b.endAt),
    organizer: b.organizer?.name ?? b.organizer?.email,
  }));

  function onSlot(start: Date, end: Date) {
    setStartAt(start);
    setEndAt(end);
    setError(null);
  }

  function submit() {
    if (!startAt || !endAt) {
      setError("Pick a time on the timeline.");
      return;
    }

    if (!authed) {
      const params = new URLSearchParams({
        room: roomSlug,
        start: startAt.toISOString(),
        end: endAt.toISOString(),
        title,
      });
      router.push(`/login?intent=1&${params.toString()}`);
      return;
    }

    startTransition(async () => {
      try {
        await createBooking({
          roomId,
          title,
          startAt,
          endAt,
        });
        router.push("/bookings");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create booking");
      }
    });
  }

  const selectedLabel =
    startAt && endAt
      ? `${format(startAt, "h:mm a")} – ${format(endAt, "h:mm a")}`
      : allowsCustomMeetingLength(planTier)
        ? "Click the timeline, then resize"
        : "Click the timeline";

  return (
    <div className="space-y-6">
      <DayTimeline
        bookings={blocks}
        onSlotClick={onSlot}
        selectedStart={startAt}
        selectedEnd={endAt}
        planTier={planTier}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Meeting title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-12 text-base"
          />
        </div>
        <div className="space-y-2">
          <Label>Selected time</Label>
          <div className="flex h-12 items-center rounded-lg border px-3 text-base">
            {selectedLabel}
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button
        size="lg"
        className="h-14 w-full text-lg sm:w-auto sm:min-w-56"
        onClick={submit}
        disabled={pending}
      >
        {authed ? (pending ? "Booking…" : "Book room") : "Sign in to book"}
      </Button>
    </div>
  );
}
