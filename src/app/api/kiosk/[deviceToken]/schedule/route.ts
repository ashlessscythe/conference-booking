import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRoomDaySchedule } from "@/features/rooms/queries";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ deviceToken: string }> },
) {
  const { deviceToken } = await ctx.params;
  const device = await prisma.kioskDevice.findUnique({
    where: { deviceToken },
  });

  if (!device?.enabled || !device.roomId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const schedule = await getRoomDaySchedule(device.roomId);
  return NextResponse.json(
    schedule.map((b) => ({
      title: b.title,
      startAt: b.startAt.toISOString(),
      endAt: b.endAt.toISOString(),
    })),
  );
}
