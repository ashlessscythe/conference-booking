import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { deriveRoomStatus } from "@/lib/room-status";
import { getOrgSettings } from "@/lib/session";
import { getRoomDaySchedule } from "@/features/rooms/queries";
import { KioskScreen } from "@/features/kiosks/components/kiosk-screen";
import { addHours, endOfDay } from "date-fns";

export const dynamic = "force-dynamic";

async function loadKiosk(deviceToken: string) {
  const device = await prisma.kioskDevice.findUnique({
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

  if (!device || !device.enabled || !device.room) {
    return null;
  }

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
    device,
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

export default async function KioskDisplayPage({
  params,
}: {
  params: Promise<{ deviceToken: string }>;
}) {
  const { deviceToken } = await params;
  const loaded = await loadKiosk(deviceToken);
  if (!loaded) {
    notFound();
  }

  // schedule unused here — client fetches on demand; keep for type sanity
  await getRoomDaySchedule(loaded.device.room!.id);

  return (
    <KioskScreen deviceToken={deviceToken} initial={loaded.payload} />
  );
}
