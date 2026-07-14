"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DeviceRotation } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const createDeviceSchema = z.object({
  name: z.string().min(1).max(80),
  roomId: z.string().optional().nullable(),
  rotation: z.nativeEnum(DeviceRotation).optional(),
});

function pairingToken() {
  return randomBytes(16).toString("hex");
}

export async function registerDevice(raw: unknown) {
  const admin = await requireAdmin();
  const data = createDeviceSchema.parse(raw);

  const device = await prisma.kioskDevice.create({
    data: {
      organizationId: admin.organizationId,
      name: data.name,
      roomId: data.roomId || null,
      rotation: data.rotation ?? "LANDSCAPE",
      pairingToken: pairingToken(),
      pairedAt: data.roomId ? new Date() : null,
    },
  });

  revalidatePath("/admin/devices");
  return device;
}

export async function assignDeviceRoom(deviceId: string, roomId: string | null) {
  const admin = await requireAdmin();
  const device = await prisma.kioskDevice.findFirstOrThrow({
    where: { id: deviceId, organizationId: admin.organizationId },
  });

  if (roomId) {
    await prisma.room.findFirstOrThrow({
      where: { id: roomId, organizationId: admin.organizationId },
    });
  }

  const updated = await prisma.kioskDevice.update({
    where: { id: device.id },
    data: {
      roomId,
      pairedAt: roomId ? new Date() : device.pairedAt,
      pairingToken: null,
    },
  });

  revalidatePath("/admin/devices");
  return updated;
}

export async function replaceDevice(deviceId: string) {
  const admin = await requireAdmin();
  const device = await prisma.kioskDevice.findFirstOrThrow({
    where: { id: deviceId, organizationId: admin.organizationId },
  });

  // Keep room assignment; issue a new device token (old display URL invalid)
  const updated = await prisma.kioskDevice.update({
    where: { id: device.id },
    data: {
      deviceToken: randomBytes(24).toString("hex"),
      pairingToken: pairingToken(),
      lastHeartbeat: null,
      pairedAt: new Date(),
      enabled: true,
    },
  });

  revalidatePath("/admin/devices");
  return updated;
}

export async function setDeviceEnabled(deviceId: string, enabled: boolean) {
  const admin = await requireAdmin();
  const device = await prisma.kioskDevice.findFirstOrThrow({
    where: { id: deviceId, organizationId: admin.organizationId },
  });

  const updated = await prisma.kioskDevice.update({
    where: { id: device.id },
    data: { enabled },
  });

  revalidatePath("/admin/devices");
  return updated;
}

export async function updateDeviceRotation(
  deviceId: string,
  rotation: DeviceRotation,
) {
  const admin = await requireAdmin();
  const device = await prisma.kioskDevice.findFirstOrThrow({
    where: { id: deviceId, organizationId: admin.organizationId },
  });

  await prisma.kioskDevice.update({
    where: { id: device.id },
    data: { rotation },
  });
  revalidatePath("/admin/devices");
}
