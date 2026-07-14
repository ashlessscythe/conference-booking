import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ deviceToken: string }> },
) {
  const { deviceToken } = await ctx.params;
  const device = await prisma.kioskDevice.findUnique({
    where: { deviceToken },
  });

  if (!device || !device.enabled) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.kioskDevice.update({
    where: { id: device.id },
    data: { lastHeartbeat: new Date() },
  });

  return NextResponse.json({ ok: true });
}
