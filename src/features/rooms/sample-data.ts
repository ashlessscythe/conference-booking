import { startOfDay, endOfDay } from "date-fns";
import {
  DEFAULT_CLEANING_BUFFER_MIN,
  DEFAULT_STARTING_SOON_MIN,
  deriveRoomStatus,
  type BookingLike,
} from "@/lib/room-status";
import type { RoomWithStatus } from "@/features/rooms/queries";

export const SAMPLE_ROOM_SLUG_PREFIX = "sample-";

export type SampleRoom = {
  id: string;
  name: string;
  slug: string;
  capacity: number;
  floor: string;
  description: string;
  outOfService: boolean;
};

/** Preset demo rooms — not loaded from the database. */
export const SAMPLE_ROOMS: SampleRoom[] = [
  {
    id: "sample-aurora",
    name: "Aurora",
    slug: "sample-aurora",
    capacity: 8,
    floor: "1",
    description: "Bright corner room with display",
    outOfService: false,
  },
  {
    id: "sample-meridian",
    name: "Meridian",
    slug: "sample-meridian",
    capacity: 4,
    floor: "1",
    description: "Huddle for quick syncs",
    outOfService: false,
  },
  {
    id: "sample-atlas",
    name: "Atlas",
    slug: "sample-atlas",
    capacity: 14,
    floor: "2",
    description: "Large boardroom",
    outOfService: false,
  },
  {
    id: "sample-cedar",
    name: "Cedar",
    slug: "sample-cedar",
    capacity: 6,
    floor: "2",
    description: "Quiet mid-floor room",
    outOfService: false,
  },
  {
    id: "sample-harbor",
    name: "Harbor",
    slug: "sample-harbor",
    capacity: 10,
    floor: "3",
    description: "Open glass conference suite",
    outOfService: false,
  },
  {
    id: "sample-zenith",
    name: "Zenith",
    slug: "sample-zenith",
    capacity: 5,
    floor: "3",
    description: "Interview / focus room",
    outOfService: false,
  },
];

type Slot = {
  title: string;
  organizer: string;
  startH: number;
  startM: number;
  endH: number;
  endM: number;
};

/** Busy weekday templates with intentional gaps between meetings. */
const SCHEDULES: Record<string, Slot[]> = {
  "sample-aurora": [
    { title: "Standup", organizer: "Jordan Lee", startH: 9, startM: 0, endH: 9, endM: 30 },
    { title: "Sprint planning", organizer: "Sam Ortiz", startH: 10, startM: 0, endH: 11, endM: 0 },
    { title: "Design critique", organizer: "Riley Chen", startH: 11, startM: 30, endH: 12, endM: 30 },
    { title: "Partner call", organizer: "Alex Kim", startH: 14, startM: 0, endH: 15, endM: 0 },
    { title: "Retro", organizer: "Jordan Lee", startH: 16, startM: 0, endH: 17, endM: 0 },
  ],
  "sample-meridian": [
    { title: "1:1", organizer: "Casey Morgan", startH: 9, startM: 30, endH: 10, endM: 0 },
    { title: "Candidate screen", organizer: "Taylor Brooks", startH: 11, startM: 0, endH: 11, endM: 45 },
    { title: "Vendor check-in", organizer: "Casey Morgan", startH: 13, startM: 0, endH: 13, endM: 30 },
    { title: "Budget sync", organizer: "Morgan Diaz", startH: 15, startM: 30, endH: 16, endM: 15 },
  ],
  "sample-atlas": [
    { title: "Leadership sync", organizer: "Pat Nguyen", startH: 8, startM: 30, endH: 9, endM: 30 },
    { title: "Q3 roadmap", organizer: "Sam Ortiz", startH: 10, startM: 0, endH: 11, endM: 30 },
    { title: "All-hands prep", organizer: "Riley Chen", startH: 13, startM: 0, endH: 14, endM: 0 },
    { title: "Board materials", organizer: "Pat Nguyen", startH: 14, startM: 30, endH: 16, endM: 0 },
    { title: "Exec wrap", organizer: "Alex Kim", startH: 17, startM: 0, endH: 17, endM: 45 },
  ],
  "sample-cedar": [
    { title: "Architecture review", organizer: "Devon Blake", startH: 9, startM: 0, endH: 10, endM: 30 },
    { title: "Incident follow-up", organizer: "Jordan Lee", startH: 12, startM: 0, endH: 12, endM: 45 },
    { title: "Launch checklist", organizer: "Devon Blake", startH: 14, startM: 0, endH: 15, endM: 30 },
  ],
  "sample-harbor": [
    { title: "Client workshop", organizer: "Taylor Brooks", startH: 9, startM: 0, endH: 11, endM: 0 },
    { title: "Working session", organizer: "Morgan Diaz", startH: 11, startM: 30, endH: 12, endM: 30 },
    { title: "Sales enablement", organizer: "Casey Morgan", startH: 13, startM: 30, endH: 15, endM: 0 },
    { title: "Demo rehearsal", organizer: "Riley Chen", startH: 15, startM: 30, endH: 16, endM: 30 },
  ],
  "sample-zenith": [
    { title: "Interview loop", organizer: "Pat Nguyen", startH: 10, startM: 0, endH: 11, endM: 0 },
    { title: "Focus block", organizer: "Alex Kim", startH: 11, startM: 30, endH: 12, endM: 30 },
    { title: "Interview loop", organizer: "Sam Ortiz", startH: 14, startM: 0, endH: 15, endM: 0 },
    { title: "Offer huddle", organizer: "Taylor Brooks", startH: 16, startM: 30, endH: 17, endM: 0 },
  ],
};

function atToday(hours: number, minutes: number, day = new Date()) {
  const d = new Date(day);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Clamp "now" into a busy weekday window so guest previews always look active
 * even outside office hours.
 */
export function sampleStatusNow(realNow = new Date()) {
  const hour = realNow.getHours();
  const minutes = realNow.getMinutes();
  const d = new Date(realNow);
  if (hour < 8) {
    d.setHours(10, 15, 0, 0);
    return d;
  }
  if (hour >= 18) {
    d.setHours(15, 40, 0, 0);
    return d;
  }
  // Keep real minute but ensure we're on "today" for status math
  d.setHours(hour, minutes, 0, 0);
  return d;
}

export function isSampleRoomSlug(slug: string) {
  return slug.startsWith(SAMPLE_ROOM_SLUG_PREFIX);
}

export function getSampleRoomBySlug(slug: string) {
  return SAMPLE_ROOMS.find((r) => r.slug === slug) ?? null;
}

export function getSampleRoomBookings(slug: string, day = new Date()): BookingLike[] {
  const slots = SCHEDULES[slug];
  if (!slots) return [];

  return slots.map((slot, i) => ({
    id: `${slug}-b${i}`,
    title: slot.title,
    startAt: atToday(slot.startH, slot.startM, day),
    endAt: atToday(slot.endH, slot.endM, day),
    status: "CONFIRMED",
    organizer: { name: slot.organizer, email: `${slug}@example.com` },
  }));
}

export function getSampleRoomDaySchedule(slug: string, day = new Date()) {
  const bookings = getSampleRoomBookings(slug, day);
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  return bookings.filter((b) => b.startAt < dayEnd && b.endAt > dayStart);
}

export function getSampleDashboardSnapshot(realNow = new Date()) {
  const statusNow = sampleStatusNow(realNow);
  const rooms: RoomWithStatus[] = SAMPLE_ROOMS.map((room) => {
    const bookings = getSampleRoomBookings(room.slug, realNow);
    return {
      id: room.id,
      name: room.name,
      slug: room.slug,
      capacity: room.capacity,
      floor: room.floor,
      outOfService: room.outOfService,
      status: deriveRoomStatus({
        outOfService: room.outOfService,
        now: statusNow,
        bookings,
        cleaningBufferMin: DEFAULT_CLEANING_BUFFER_MIN,
        startingSoonMin: DEFAULT_STARTING_SOON_MIN,
      }),
    };
  });

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

  return { rooms, freeNow, freeSoon, happeningNow, nextMeetings, now: statusNow };
}
