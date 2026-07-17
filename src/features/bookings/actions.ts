"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, getOrgSettings } from "@/lib/session";
import {
  createBookingSchema,
  updateBookingSchema,
} from "@/features/bookings/validation";
import { clearBookingIntent } from "@/lib/booking-intent";
import {
  assertBookingFitsPlan,
  resolveEffectivePlan,
} from "@/lib/billing/plans";

async function assertNoOverlap(input: {
  roomId: string;
  startAt: Date;
  endAt: Date;
  cleaningBufferMin: number;
  excludeId?: string;
}) {
  const bufferMs = input.cleaningBufferMin * 60_000;
  const windowStart = new Date(input.startAt.getTime() - bufferMs);
  const windowEnd = new Date(input.endAt.getTime() + bufferMs);

  const conflict = await prisma.booking.findFirst({
    where: {
      roomId: input.roomId,
      status: "CONFIRMED",
      id: input.excludeId ? { not: input.excludeId } : undefined,
      startAt: { lt: windowEnd },
      endAt: { gt: windowStart },
    },
  });

  if (conflict) {
    throw new Error(
      "This time overlaps another booking or its cleaning buffer.",
    );
  }
}

async function loadOrgPlanForRoom(organizationId: string) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      planTier: true,
      stripeSubscriptionStatus: true,
      promoExpiresAt: true,
    },
  });
  return resolveEffectivePlan(org);
}

export async function createBooking(raw: unknown) {
  const user = await requireUser();
  const data = createBookingSchema.parse(raw);

  const room = await prisma.room.findUniqueOrThrow({
    where: { id: data.roomId },
  });
  if (room.outOfService) {
    throw new Error("Room is out of service.");
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: room.organizationId,
      },
    },
  });
  if (!membership) {
    throw new Error("You must join this organization before booking.");
  }

  const planTier = await loadOrgPlanForRoom(room.organizationId);
  assertBookingFitsPlan({
    planTier,
    startAt: data.startAt,
    endAt: data.endAt,
  });

  const settings = await getOrgSettings(room.organizationId);
  await assertNoOverlap({
    roomId: room.id,
    startAt: data.startAt,
    endAt: data.endAt,
    cleaningBufferMin: settings.cleaningBufferMin,
  });

  const booking = await prisma.booking.create({
    data: {
      roomId: room.id,
      organizerId: user.id,
      title: data.title,
      startAt: data.startAt,
      endAt: data.endAt,
    },
  });

  await clearBookingIntent();
  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/rooms/${room.slug}`);
  return booking;
}

export async function updateBooking(raw: unknown) {
  const user = await requireUser();
  const data = updateBookingSchema.parse(raw);

  const existing = await prisma.booking.findUniqueOrThrow({
    where: { id: data.id },
    include: { room: true },
  });

  const isAdmin = user.role === "ADMIN" || user.role === "OWNER";
  if (existing.organizerId !== user.id && !isAdmin) {
    throw new Error("Not allowed to edit this booking.");
  }
  if (existing.status === "CANCELLED") {
    throw new Error("Cannot edit a cancelled booking.");
  }

  const planTier = await loadOrgPlanForRoom(existing.room.organizationId);
  assertBookingFitsPlan({
    planTier,
    startAt: data.startAt,
    endAt: data.endAt,
  });

  const settings = await getOrgSettings(existing.room.organizationId);
  await assertNoOverlap({
    roomId: existing.roomId,
    startAt: data.startAt,
    endAt: data.endAt,
    cleaningBufferMin: settings.cleaningBufferMin,
    excludeId: existing.id,
  });

  const booking = await prisma.booking.update({
    where: { id: existing.id },
    data: {
      title: data.title,
      startAt: data.startAt,
      endAt: data.endAt,
    },
  });

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/rooms/${existing.room.slug}`);
  revalidatePath("/admin/bookings");
  return booking;
}

export async function cancelBooking(id: string) {
  const user = await requireUser();
  const existing = await prisma.booking.findUniqueOrThrow({
    where: { id },
    include: { room: true },
  });

  const isAdmin = user.role === "ADMIN" || user.role === "OWNER";
  if (existing.organizerId !== user.id && !isAdmin) {
    throw new Error("Not allowed to cancel this booking.");
  }

  await prisma.booking.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/rooms/${existing.room.slug}`);
  revalidatePath("/admin/bookings");
}
