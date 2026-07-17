"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { canCreateRoom, resolveEffectivePlan, roomLimitForPlan } from "@/lib/billing/plans";
import { RoomLimitError } from "@/lib/billing/errors";

const roomSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(80).optional(),
  capacity: z.coerce.number().int().min(1).max(500),
  floor: z.string().max(40).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  outOfService: z.coerce.boolean().optional(),
});

export async function createRoom(raw: unknown) {
  const admin = await requireAdmin();
  const data = roomSchema.parse(raw);
  const slug = slugify(data.slug || data.name);

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: admin.organizationId },
    select: {
      planTier: true,
      stripeSubscriptionStatus: true,
      promoExpiresAt: true,
      _count: { select: { rooms: true } },
    },
  });

  const effective = resolveEffectivePlan(org);
  if (
    !canCreateRoom({
      planTier: effective,
      currentRoomCount: org._count.rooms,
    })
  ) {
    const limit = roomLimitForPlan(effective);
    throw new RoomLimitError(
      effective === "FREE"
        ? `Free plan includes ${limit} rooms. Upgrade to Pro or redeem a promo to add more.`
        : `Room limit of ${limit} reached for this organization.`,
      limit,
      effective,
    );
  }

  const room = await prisma.room.create({
    data: {
      organizationId: admin.organizationId,
      name: data.name,
      slug,
      capacity: data.capacity,
      floor: data.floor || null,
      description: data.description || null,
      outOfService: data.outOfService ?? false,
    },
  });

  revalidatePath("/admin/rooms");
  revalidatePath("/");
  revalidatePath("/rooms");
  return room;
}

export async function updateRoom(id: string, raw: unknown) {
  const admin = await requireAdmin();
  const data = roomSchema.parse(raw);
  const slug = slugify(data.slug || data.name);

  const existing = await prisma.room.findFirstOrThrow({
    where: { id, organizationId: admin.organizationId },
  });

  const room = await prisma.room.update({
    where: { id: existing.id },
    data: {
      name: data.name,
      slug,
      capacity: data.capacity,
      floor: data.floor || null,
      description: data.description || null,
      outOfService: data.outOfService ?? existing.outOfService,
    },
  });

  revalidatePath("/admin/rooms");
  revalidatePath(`/rooms/${room.slug}`);
  revalidatePath("/");
  return room;
}

export async function regenerateRoomQr(roomId: string) {
  const admin = await requireAdmin();
  const room = await prisma.room.findFirstOrThrow({
    where: { id: roomId, organizationId: admin.organizationId },
  });

  const updated = await prisma.room.update({
    where: { id: room.id },
    data: { qrVersion: { increment: 1 } },
  });

  revalidatePath("/admin/qr");
  revalidatePath(`/rooms/${updated.slug}`);
  return updated;
}

export async function toggleRoomOutOfService(roomId: string) {
  const admin = await requireAdmin();
  const room = await prisma.room.findFirstOrThrow({
    where: { id: roomId, organizationId: admin.organizationId },
  });
  const updated = await prisma.room.update({
    where: { id: room.id },
    data: { outOfService: !room.outOfService },
  });
  revalidatePath("/admin/rooms");
  revalidatePath(`/rooms/${updated.slug}`);
  revalidatePath("/");
  return updated;
}
