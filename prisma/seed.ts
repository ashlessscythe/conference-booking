import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function atToday(hours: number, minutes = 0) {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

async function main() {
  await prisma.booking.deleteMany();
  await prisma.kioskDevice.deleteMany();
  await prisma.room.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.systemSettings.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      email: "admin@example.com",
      name: "Admin User",
      emailVerified: new Date(),
    },
  });

  const member = await prisma.user.create({
    data: {
      email: "member@example.com",
      name: "Alex Member",
      emailVerified: new Date(),
    },
  });

  const org = await prisma.organization.create({
    data: {
      name: "Aptiv HQ",
      slug: "aptiv-hq",
      settings: {
        create: {
          cleaningBufferMin: 10,
          startingSoonMin: 15,
          heartbeatTimeoutMin: 5,
        },
      },
      members: {
        create: [
          { userId: admin.id, role: "OWNER" },
          { userId: member.id, role: "MEMBER" },
        ],
      },
    },
  });

  const rooms = await Promise.all(
    [
      {
        name: "Orion",
        slug: "orion",
        capacity: 8,
        floor: "2",
        description: "Glass-walled room with display",
      },
      {
        name: "Nova",
        slug: "nova",
        capacity: 4,
        floor: "2",
        description: "Huddle space",
      },
      {
        name: "Helios",
        slug: "helios",
        capacity: 12,
        floor: "3",
        description: "Large conference room",
      },
    ].map((r) =>
      prisma.room.create({
        data: { ...r, organizationId: org.id },
      }),
    ),
  );

  const [orion, nova, helios] = rooms;

  await prisma.booking.createMany({
    data: [
      {
        roomId: orion.id,
        organizerId: member.id,
        title: "Sprint Planning",
        startAt: atToday(9, 0),
        endAt: atToday(10, 0),
      },
      {
        roomId: orion.id,
        organizerId: admin.id,
        title: "Design Sync",
        startAt: atToday(11, 0),
        endAt: atToday(12, 0),
      },
      {
        roomId: nova.id,
        organizerId: member.id,
        title: "1:1",
        startAt: atToday(14, 0),
        endAt: atToday(14, 30),
      },
      {
        roomId: helios.id,
        organizerId: admin.id,
        title: "All Hands",
        startAt: atToday(15, 0),
        endAt: atToday(16, 0),
      },
    ],
  });

  await prisma.kioskDevice.create({
    data: {
      organizationId: org.id,
      roomId: orion.id,
      name: "Orion Tablet",
      deviceToken: "demo-orion-kiosk",
      enabled: true,
      pairedAt: new Date(),
      lastHeartbeat: new Date(),
    },
  });

  console.log("Seed complete.");
  console.log("Admin: admin@example.com");
  console.log("Member: member@example.com");
  console.log("Kiosk: /display/demo-orion-kiosk");
  console.log("Rooms: /rooms/orion, /rooms/nova, /rooms/helios");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
