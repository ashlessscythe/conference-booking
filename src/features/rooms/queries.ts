import { startOfDay, endOfDay, addHours } from "date-fns";
import { prisma } from "@/lib/db";
import {
  deriveRoomStatus,
  type DerivedRoomStatus,
} from "@/lib/room-status";
import { getOrgSettings, getSessionOrganizationId } from "@/lib/session";

export type RoomWithStatus = {
  id: string;
  name: string;
  slug: string;
  capacity: number;
  floor: string | null;
  outOfService: boolean;
  status: DerivedRoomStatus;
};

/** @deprecated Use getSessionOrganizationId — never pick an arbitrary org. */
export async function getDefaultOrganizationId() {
  return getSessionOrganizationId();
}

export async function loadRoomsWithStatus(organizationId: string, now = new Date()) {
  const settings = await getOrgSettings(organizationId);
  const rooms = await prisma.room.findMany({
    where: { organizationId },
    include: {
      bookings: {
        where: {
          status: "CONFIRMED",
          endAt: { gte: addHours(now, -2) },
          startAt: { lte: endOfDay(now) },
        },
        include: {
          organizer: { select: { name: true, email: true } },
        },
        orderBy: { startAt: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return rooms.map((room): RoomWithStatus => ({
    id: room.id,
    name: room.name,
    slug: room.slug,
    capacity: room.capacity,
    floor: room.floor,
    outOfService: room.outOfService,
    status: deriveRoomStatus({
      outOfService: room.outOfService,
      now,
      bookings: room.bookings,
      cleaningBufferMin: settings.cleaningBufferMin,
      startingSoonMin: settings.startingSoonMin,
    }),
  }));
}

export async function getDashboardSnapshot(organizationId: string) {
  const now = new Date();
  const rooms = await loadRoomsWithStatus(organizationId, now);

  const freeNow = rooms.filter((r) => r.status.key === "AVAILABLE");
  const freeSoon = rooms.filter(
    (r) =>
      r.status.key === "OCCUPIED" ||
      r.status.key === "CLEANING_BUFFER" ||
      r.status.key === "STARTING_SOON",
  );
  const happeningNow = rooms
    .filter((r) => r.status.current)
    .map((r) => ({
      room: r,
      booking: r.status.current!,
    }));
  const nextMeetings = rooms
    .filter((r) => r.status.next && !r.status.current)
    .map((r) => ({
      room: r,
      booking: r.status.next!,
    }))
    .sort(
      (a, b) => a.booking.startAt.getTime() - b.booking.startAt.getTime(),
    );

  return { rooms, freeNow, freeSoon, happeningNow, nextMeetings, now };
}

export async function getRoomDaySchedule(roomId: string, day = new Date()) {
  return prisma.booking.findMany({
    where: {
      roomId,
      status: "CONFIRMED",
      startAt: { lt: endOfDay(day) },
      endAt: { gt: startOfDay(day) },
    },
    include: {
      organizer: { select: { name: true, email: true } },
    },
    orderBy: { startAt: "asc" },
  });
}

export async function getRoomBySlug(slug: string) {
  return prisma.room.findFirst({
    where: { slug },
    include: {
      organization: true,
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
  });
}

export async function getOrganizationPlan(organizationId: string) {
  return prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      planTier: true,
      _count: { select: { rooms: true } },
    },
  });
}
