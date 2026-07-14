import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { loadRoomsWithStatus } from "@/features/rooms/queries";
import { DEFAULT_HEARTBEAT_TIMEOUT_MIN } from "@/lib/room-status";
import { LinkButton } from "@/components/link-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();
  const [roomCount, bookingCount, userCount, devices, rooms] =
    await Promise.all([
      prisma.room.count({ where: { organizationId: admin.organizationId } }),
      prisma.booking.count({
        where: {
          room: { organizationId: admin.organizationId },
          status: "CONFIRMED",
          endAt: { gte: new Date() },
        },
      }),
      prisma.membership.count({
        where: { organizationId: admin.organizationId },
      }),
      prisma.kioskDevice.findMany({
        where: { organizationId: admin.organizationId },
        include: { room: true },
      }),
      loadRoomsWithStatus(admin.organizationId),
    ]);

  const timeoutMs = DEFAULT_HEARTBEAT_TIMEOUT_MIN * 60_000;
  const nowMs = new Date().getTime();
  const online = devices.filter(
    (d) =>
      d.enabled &&
      d.lastHeartbeat &&
      nowMs - d.lastHeartbeat.getTime() < timeoutMs,
  ).length;
  const occupied = rooms.filter((r) => r.status.key === "OCCUPIED").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Snapshot of rooms, bookings, and tablet health.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/admin/rooms">Manage rooms</LinkButton>
          <LinkButton href="/admin/devices" variant="outline">
            Devices
          </LinkButton>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Rooms" value={roomCount} hint={`${occupied} occupied now`} />
        <StatCard title="Upcoming bookings" value={bookingCount} hint="Confirmed, not ended" />
        <StatCard title="People" value={userCount} hint="Org memberships" />
        <StatCard
          title="Tablets online"
          value={online}
          hint={`${devices.length} registered`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Occupancy</CardTitle>
            <CardDescription>Live room state</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {rooms.slice(0, 6).map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border bg-white px-3 py-2"
              >
                <span className="font-medium">{r.name}</span>
                <span className="text-sm text-muted-foreground">
                  {r.status.label}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Device health</CardTitle>
            <CardDescription>Last heartbeat</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {devices.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No devices yet. Register a tablet under Devices.
              </p>
            )}
            {devices.map((d) => {
              const isOnline =
                d.enabled &&
                d.lastHeartbeat &&
                nowMs - d.lastHeartbeat.getTime() < timeoutMs;
              return (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-lg border bg-white px-3 py-2"
                >
                  <div>
                    <div className="font-medium">{d.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {d.room?.name ?? "Unassigned"}
                    </div>
                  </div>
                  <span
                    className={
                      isOnline
                        ? "text-sm font-semibold text-emerald-700"
                        : "text-sm font-semibold text-neutral-500"
                    }
                  >
                    {!d.enabled ? "Disabled" : isOnline ? "Online" : "Offline"}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: number;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-4xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
