"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { format } from "date-fns";
import { StatusBanner } from "@/features/rooms/components/status-badge";
import type { RoomStatusKey } from "@/lib/room-status";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";

function subscribeClock(onChange: () => void) {
  const id = setInterval(onChange, 1000);
  return () => clearInterval(id);
}

// Returns the current unix second (stable within the same second, so the
// snapshot is referentially cached). null on the server / during the first
// client render so SSR and hydration match before the client clock takes over.
function getClockSnapshot(): number | null {
  return Math.floor(Date.now() / 1000);
}

function getClockServerSnapshot(): number | null {
  return null;
}

type KioskPayload = {
  roomName: string;
  roomSlug: string;
  statusKey: RoomStatusKey;
  statusLabel: string;
  currentTitle: string | null;
  organizer: string | null;
  minutesRemaining: number | null;
  nextTitle: string | null;
  nextStart: string | null;
  upcomingHint: string;
  qrDataUrl: string;
};

export function KioskScreen({
  deviceToken,
  initial,
}: {
  deviceToken: string;
  initial: KioskPayload;
}) {
  const [data, setData] = useState(initial);
  const clockSecond = useSyncExternalStore(
    subscribeClock,
    getClockSnapshot,
    getClockServerSnapshot,
  );
  const now = clockSecond == null ? null : new Date(clockSecond * 1000);
  const [view, setView] = useState<"main" | "schedule" | "qr">("main");
  const [schedule, setSchedule] = useState<
    { title: string; startAt: string; endAt: string }[]
  >([]);

  useEffect(() => {
    const refresh = setInterval(async () => {
      try {
        await fetch(`/api/kiosk/${deviceToken}/heartbeat`, { method: "POST" });
        const res = await fetch(`/api/kiosk/${deviceToken}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch {
        // keep last good frame
      }
    }, 15_000);

    void fetch(`/api/kiosk/${deviceToken}/heartbeat`, { method: "POST" });

    return () => {
      clearInterval(refresh);
    };
  }, [deviceToken]);

  async function showSchedule() {
    const res = await fetch(`/api/kiosk/${deviceToken}/schedule`);
    if (res.ok) {
      setSchedule(await res.json());
      setView("schedule");
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-950 text-neutral-50">
      <div className="flex items-center justify-between px-8 py-5">
        <div className="text-4xl font-bold tracking-tight md:text-5xl">
          {data.roomName}
        </div>
        <div className="text-4xl font-semibold tabular-nums md:text-5xl">
          {now ? format(now, "h:mm a") : "\u00a0"}
        </div>
      </div>

      <StatusBanner status={data.statusKey}>
        <div className="text-2xl font-semibold md:text-3xl">
          {data.minutesRemaining != null
            ? `${data.minutesRemaining} min`
            : data.statusLabel}
        </div>
      </StatusBanner>

      {view === "main" && (
        <div className="grid flex-1 grid-rows-2 gap-0">
          <section className="flex flex-col justify-center border-b border-neutral-800 px-8 py-6">
            <p className="text-xl uppercase tracking-[0.2em] text-neutral-400">
              Current meeting
            </p>
            <p className="mt-3 text-5xl font-bold leading-tight md:text-6xl">
              {data.currentTitle ?? "No meeting"}
            </p>
            <p className="mt-4 text-3xl text-neutral-300">
              {data.organizer
                ? `Organizer · ${data.organizer}`
                : data.nextStart && now
                  ? `Next at ${format(new Date(data.nextStart), "h:mm a")}`
                  : data.upcomingHint}
            </p>
          </section>
          <section className="flex flex-col justify-center px-8 py-6">
            <p className="text-xl uppercase tracking-[0.2em] text-neutral-400">
              Next
            </p>
            <p className="mt-3 text-4xl font-semibold md:text-5xl">
              {data.nextTitle
                ? `${data.nextTitle}${data.nextStart && now ? ` · ${format(new Date(data.nextStart), "h:mm a")}` : ""}`
                : "Open rest of day"}
            </p>
          </section>
        </div>
      )}

      {view === "schedule" && (
        <div className="flex-1 space-y-4 overflow-hidden px-8 py-6">
          <p className="text-2xl font-semibold">Today&apos;s schedule</p>
          <div className="space-y-3">
            {schedule.length === 0 && (
              <p className="text-3xl text-neutral-400">No meetings today</p>
            )}
            {schedule.slice(0, 5).map((s, i) => (
              <div key={i} className="text-3xl font-medium">
                {format(new Date(s.startAt), "h:mm a")} –{" "}
                {format(new Date(s.endAt), "h:mm a")} · {s.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "qr" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.qrDataUrl}
            alt="Room QR"
            className="h-64 w-64 rounded-2xl bg-white p-4"
          />
          <p className="max-w-xl text-center text-3xl text-neutral-300">
            Scan to open the room page and book from your phone.
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 border-t border-neutral-800 p-6">
        <LinkButton
          href={`/rooms/${data.roomSlug}/book`}
          className="h-20 text-2xl font-semibold"
          variant="secondary"
        >
          Book Now
        </LinkButton>
        <Button
          className="h-20 text-2xl font-semibold"
          variant="secondary"
          onClick={() => {
            if (view === "schedule") setView("main");
            else void showSchedule();
          }}
        >
          Today&apos;s Schedule
        </Button>
        <Button
          className="h-20 text-2xl font-semibold"
          variant="secondary"
          onClick={() => setView(view === "qr" ? "main" : "qr")}
        >
          Scan QR
        </Button>
      </div>
    </div>
  );
}
