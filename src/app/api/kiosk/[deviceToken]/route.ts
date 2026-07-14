import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { addHours, endOfDay, format } from "date-fns";
import { prisma } from "@/lib/db";
import { deriveRoomStatus } from "@/lib/room-status";
import { getOrgSettings } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ deviceToken: string }> },
) {
  const { deviceToken } = await ctx.params;
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

  if (!device?.enabled || !device.room) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const settings = await getOrgSettings(device.organizationId);
  const status = deriveRoomStatus({
    outOfService: device.room.outOfService,
    bookings: device.room.bookings,
    cleaningBufferMin: settings.cleaningBufferMin,
    startingSoonMin: settings.startingSoonMin,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const qrDataUrl = await QRCode.toDataURL(
    `${appUrl}/rooms/${device.room.slug}?v=${device.room.qrVersion}`,
    { width: 400, margin: 1 },
  );

  return NextResponse.json({
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
    upcomingHint: status.next
      ? `Next at ${format(status.next.startAt, "h:mm a")}`
      : "Available for booking",
    qrDataUrl,
  });
}
