"use client";

import { format, differenceInMinutes, startOfDay, setHours, setMinutes } from "date-fns";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/use-hydrated";

type Block = {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  organizer?: string | null;
};

const DAY_START = 8;
const DAY_END = 20;
const TOTAL_MIN = (DAY_END - DAY_START) * 60;

function toOffset(date: Date) {
  const minutes =
    date.getHours() * 60 + date.getMinutes() - DAY_START * 60;
  return Math.min(Math.max(minutes, 0), TOTAL_MIN);
}

export function DayTimeline({
  bookings,
  onSlotClick,
  selectedStart,
  selectedEnd,
}: {
  bookings: Block[];
  onSlotClick?: (start: Date, end: Date) => void;
  selectedStart?: Date | null;
  selectedEnd?: Date | null;
}) {
  // Booking positions and labels depend on the viewer's timezone (getHours /
  // date-fns format), so they can only be computed correctly on the client.
  // Render them after hydration to keep SSR and the first client render in sync.
  const hydrated = useHydrated();

  const hours = Array.from(
    { length: DAY_END - DAY_START },
    (_, i) => DAY_START + i,
  );

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!onSlotClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const minutes = Math.floor(ratio * TOTAL_MIN);
    const snapped = Math.round(minutes / 30) * 30;
    const base = startOfDay(new Date());
    const start = setMinutes(
      setHours(base, DAY_START + Math.floor(snapped / 60)),
      snapped % 60,
    );
    const end = new Date(start.getTime() + 30 * 60_000);
    onSlotClick(start, end);
  }

  return (
    <div className="space-y-3">
      <div className="relative flex text-xs text-muted-foreground">
        {hours.map((h) => (
          <div key={h} className="flex-1">
            {format(setHours(startOfDay(new Date()), h), "ha")}
          </div>
        ))}
      </div>
      <div
        className={cn(
          "relative h-28 rounded-xl border bg-muted/40",
          onSlotClick && "cursor-pointer",
        )}
        onClick={handleClick}
        role={onSlotClick ? "button" : undefined}
        tabIndex={onSlotClick ? 0 : undefined}
        aria-label="Day availability timeline"
      >
        {hydrated &&
          bookings.map((b) => {
          const left = (toOffset(b.startAt) / TOTAL_MIN) * 100;
          const width =
            (Math.max(differenceInMinutes(b.endAt, b.startAt), 15) /
              TOTAL_MIN) *
            100;
          return (
            <div
              key={b.id}
              className="absolute top-2 bottom-2 overflow-hidden rounded-lg bg-red-700 px-2 py-1 text-xs text-red-50 shadow-sm"
              style={{ left: `${left}%`, width: `${Math.max(width, 2)}%` }}
              title={`${b.title} · ${format(b.startAt, "h:mm a")} – ${format(b.endAt, "h:mm a")}`}
            >
              <div className="truncate font-semibold">{b.title}</div>
              <div className="truncate opacity-90">
                {format(b.startAt, "h:mm")}–{format(b.endAt, "h:mm")}
              </div>
            </div>
          );
        })}
        {selectedStart && selectedEnd && (
          <div
            className="absolute top-2 bottom-2 rounded-lg border-2 border-emerald-600 bg-emerald-500/40"
            style={{
              left: `${(toOffset(selectedStart) / TOTAL_MIN) * 100}%`,
              width: `${(Math.max(differenceInMinutes(selectedEnd, selectedStart), 15) / TOTAL_MIN) * 100}%`,
            }}
          />
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Green selection is your hold. Red blocks are booked. Click the timeline
        to pick a 30-minute slot.
      </p>
    </div>
  );
}
