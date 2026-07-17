import Link from "next/link";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { deriveRoomStatus, type RoomStatusKey } from "@/lib/room-status";
import { getOrgSettings } from "@/lib/session";
import { getRoomDaySchedule } from "@/features/rooms/queries";
import { KioskScreen } from "@/features/kiosks/components/kiosk-screen";
import { addHours, endOfDay } from "date-fns";

export const dynamic = "force-dynamic";

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

async function findDevice(deviceToken: string) {
  return prisma.kioskDevice.findUnique({
    where: { deviceToken },
    include: {
      room: {
        include: {
          bookings: {
            where: {
              status: "CONFIRMED",
              endAt: { gte: addHours(new Date(), -2) },
              startAt: { lte: endOfDay(new Date()) },
            },
            include: {
              organizer: { select: { name: true, email: true } },
            },
            orderBy: { startAt: "asc" },
          },
        },
      },
    },
  });
}

async function loadKiosk(deviceToken: string): Promise<
  | { ok: true; roomId: string; payload: KioskPayload }
  | { ok: false; reason: "missing" | "disabled" | "unassigned" }
> {
  const device = await findDevice(deviceToken);

  if (!device) return { ok: false, reason: "missing" };
  if (!device.enabled) return { ok: false, reason: "disabled" };
  if (!device.room) return { ok: false, reason: "unassigned" };

  const settings = await getOrgSettings(device.organizationId);
  const status = deriveRoomStatus({
    outOfService: device.room.outOfService,
    bookings: device.room.bookings,
    cleaningBufferMin: settings.cleaningBufferMin,
    startingSoonMin: settings.startingSoonMin,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const roomUrl = `${appUrl}/rooms/${device.room.slug}?v=${device.room.qrVersion}`;
  const qrDataUrl = await QRCode.toDataURL(roomUrl, {
    width: 400,
    margin: 1,
  });

  return {
    ok: true,
    roomId: device.room.id,
    payload: {
      roomName: device.room.name,
      roomSlug: device.room.slug,
      statusKey: status.key,
      statusLabel: status.label,
      currentTitle: status.current?.title ?? null,
      organizer:
        status.current?.organizer?.name ??
        status.current?.organizer?.email ??
        null,
      minutesRemaining: status.minutesRemaining,
      nextTitle: status.next?.title ?? null,
      nextStart: status.next?.startAt?.toISOString() ?? null,
      upcomingHint: status.next ? "Upcoming meeting" : "Available for booking",
      qrDataUrl,
    },
  };
}

function KioskUnavailable({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-zinc-100">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="max-w-md text-zinc-400">{detail}</p>
      <Link
        href="/display/exit?next=/admin/devices"
        className="mt-2 text-sm text-sky-400 underline underline-offset-4 hover:text-sky-300"
      >
        Exit kiosk mode
      </Link>
    </div>
  );
}

export default async function KioskDisplayPage({
  params,
}: {
  params: Promise<{ deviceToken: string }>;
}) {
  const { deviceToken } = await params;
  const loaded = await loadKiosk(deviceToken);

  if (!loaded.ok) {
    if (loaded.reason === "unassigned") {
      return (
        <KioskUnavailable
          title="Room not assigned"
          detail="This tablet is registered but has no room yet. Assign a room in Admin → Tablet devices, then reload."
        />
      );
    }
    if (loaded.reason === "disabled") {
      return (
        <KioskUnavailable
          title="Device disabled"
          detail="This kiosk has been disabled. Re-enable it in Admin → Tablet devices, or exit kiosk mode."
        />
      );
    }
    return (
      <KioskUnavailable
        title="Unknown device"
        detail="This display link is invalid or the device was replaced. Exit kiosk mode to continue."
      />
    );
  }

  // schedule unused here — client fetches on demand; keep for type sanity
  await getRoomDaySchedule(loaded.roomId);

  return (
    <KioskScreen deviceToken={deviceToken} initial={loaded.payload} />
  );
}
