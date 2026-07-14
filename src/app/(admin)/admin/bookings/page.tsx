import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { cancelBooking } from "@/features/bookings/actions";
import { Button } from "@/components/ui/button";
import { LocalTime } from "@/components/local-time";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminBookingsPage() {
  const admin = await requireAdmin();
  const weekAgo = new Date(new Date().getTime() - 7 * 24 * 60 * 60_000);
  const bookings = await prisma.booking.findMany({
    where: {
      room: { organizationId: admin.organizationId },
      startAt: { gte: weekAgo },
    },
    include: {
      room: true,
      organizer: true,
    },
    orderBy: { startAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Bookings</h2>
        <p className="text-muted-foreground">
          Recent and upcoming meetings across all rooms.
        </p>
      </div>

      <div className="space-y-3">
        {bookings.map((b) => (
          <Card key={b.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-lg">{b.title}</CardTitle>
                <CardDescription>
                  {b.room.name} ·{" "}
                  <LocalTime value={b.startAt} pattern="MMM d, h:mm a" /> –{" "}
                  <LocalTime value={b.endAt} pattern="h:mm a" /> ·{" "}
                  {b.organizer.name ?? b.organizer.email} · {b.status}
                </CardDescription>
              </div>
              {b.status === "CONFIRMED" && b.endAt > new Date() && (
                <form
                  action={async () => {
                    "use server";
                    await cancelBooking(b.id);
                  }}
                >
                  <Button type="submit" variant="outline" size="sm">
                    Cancel
                  </Button>
                </form>
              )}
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
    </div>
  );
}
