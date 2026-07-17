"use client";

import { useCallback, useEffect, useRef } from "react";
import { format, differenceInMinutes, startOfDay, setHours } from "date-fns";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/use-hydrated";
import type { PlanTierLike } from "@/lib/billing/plans";
import {
  allowsCustomMeetingLength,
  bookingStepMinutesForPlan,
  FREE_BOOKING_DURATION_MIN,
  minBookingDurationMinutesForPlan,
} from "@/lib/billing/plans";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  TOTAL_DAY_MINUTES,
  initialSelectionFromClick,
  nudgeSelectionEdge,
  offsetMinutesFromDate,
  resizeSelection,
  type ResizeEdge,
} from "@/features/bookings/timeline-math";

type Block = {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  organizer?: string | null;
};

export function DayTimeline({
  bookings,
  onSlotClick,
  selectedStart,
  selectedEnd,
  planTier = "FREE",
}: {
  bookings: Block[];
  onSlotClick?: (start: Date, end: Date) => void;
  selectedStart?: Date | null;
  selectedEnd?: Date | null;
  planTier?: PlanTierLike;
}) {
  // Booking positions and labels depend on the viewer's timezone (getHours /
  // date-fns format), so they can only be computed correctly on the client.
  // Render them after hydration to keep SSR and the first client render in sync.
  const hydrated = useHydrated();
  const trackRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<{ start: Date; end: Date } | null>(null);
  const onSlotClickRef = useRef(onSlotClick);

  useEffect(() => {
    onSlotClickRef.current = onSlotClick;
  }, [onSlotClick]);

  useEffect(() => {
    if (selectedStart && selectedEnd) {
      selectionRef.current = { start: selectedStart, end: selectedEnd };
    } else {
      selectionRef.current = null;
    }
  }, [selectedStart, selectedEnd]);

  const canCustomize = allowsCustomMeetingLength(planTier);
  const stepMin = bookingStepMinutesForPlan(planTier);
  const minDuration = minBookingDurationMinutesForPlan(planTier);
  const defaultDuration = FREE_BOOKING_DURATION_MIN;

  const hours = Array.from(
    { length: DAY_END_HOUR - DAY_START_HOUR },
    (_, i) => DAY_START_HOUR + i,
  );

  const ratioFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return (clientX - rect.left) / rect.width;
  }, []);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!onSlotClick) return;
    if ((e.target as HTMLElement).closest("[data-resize-handle]")) return;
    if ((e.target as HTMLElement).closest("[data-booking-block]")) return;

    const base = startOfDay(new Date());
    const { start, end } = initialSelectionFromClick({
      ratio: ratioFromClientX(e.clientX),
      stepMin,
      defaultDurationMin: defaultDuration,
      baseDay: base,
    });
    onSlotClick(start, end);
  }

  function beginResize(edge: ResizeEdge, pointerId: number, target: Element) {
    if (!onSlotClickRef.current || !selectionRef.current || !canCustomize) {
      return;
    }
    target.setPointerCapture(pointerId);
    const base = startOfDay(selectionRef.current.start);

    function onMove(ev: PointerEvent) {
      const current = selectionRef.current;
      if (!current) return;
      const next = resizeSelection({
        edge,
        pointerRatio: ratioFromClientX(ev.clientX),
        stepMin,
        minDurationMin: minDuration,
        currentStart: current.start,
        currentEnd: current.end,
        baseDay: base,
      });
      selectionRef.current = next;
      onSlotClickRef.current?.(next.start, next.end);
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function onHandleKeyDown(
    edge: ResizeEdge,
    e: React.KeyboardEvent<HTMLButtonElement>,
  ) {
    if (!onSlotClick || !selectedStart || !selectedEnd || !canCustomize) return;
    const base = startOfDay(selectedStart);
    let deltaSteps = 0;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") deltaSteps = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") deltaSteps = 1;
    if (!deltaSteps) return;
    e.preventDefault();
    const next = nudgeSelectionEdge({
      edge,
      deltaSteps,
      stepMin,
      minDurationMin: minDuration,
      currentStart: selectedStart,
      currentEnd: selectedEnd,
      baseDay: base,
    });
    onSlotClick(next.start, next.end);
  }

  const helpText = !onSlotClick
    ? "Red blocks are booked."
    : canCustomize
      ? "Green selection is your hold. Red blocks are booked. Click to pick a start time, then drag the handles to set a custom length (15-minute steps)."
      : "Green selection is your hold. Red blocks are booked. Click the timeline to pick a fixed 30-minute slot. Upgrade to Pro for custom meeting lengths.";

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
        ref={trackRef}
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
            const left =
              (offsetMinutesFromDate(b.startAt) / TOTAL_DAY_MINUTES) * 100;
            const width =
              (Math.max(differenceInMinutes(b.endAt, b.startAt), 15) /
                TOTAL_DAY_MINUTES) *
              100;
            return (
              <div
                key={b.id}
                data-booking-block
                className="absolute top-2 bottom-2 z-10 overflow-hidden rounded-lg bg-red-700 px-2 py-1 text-xs text-red-50 shadow-sm"
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
            className="absolute top-2 bottom-2 z-20 rounded-lg border-2 border-emerald-600 bg-emerald-500/40"
            style={{
              left: `${(offsetMinutesFromDate(selectedStart) / TOTAL_DAY_MINUTES) * 100}%`,
              width: `${(Math.max(differenceInMinutes(selectedEnd, selectedStart), 15) / TOTAL_DAY_MINUTES) * 100}%`,
            }}
          >
            {canCustomize && onSlotClick && (
              <>
                <button
                  type="button"
                  data-resize-handle
                  aria-label="Resize meeting start"
                  className="absolute left-0 top-0 z-30 h-full w-3 -translate-x-1/2 cursor-ew-resize rounded-full bg-emerald-700 shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    beginResize("start", e.pointerId, e.currentTarget);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => onHandleKeyDown("start", e)}
                />
                <button
                  type="button"
                  data-resize-handle
                  aria-label="Resize meeting end"
                  className="absolute right-0 top-0 z-30 h-full w-3 translate-x-1/2 cursor-ew-resize rounded-full bg-emerald-700 shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    beginResize("end", e.pointerId, e.currentTarget);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => onHandleKeyDown("end", e)}
                />
              </>
            )}
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{helpText}</p>
    </div>
  );
}
