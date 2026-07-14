import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { cancelBooking } from "@/features/bookings/actions";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { LocalTime } from "@/components/local-time";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function MyBookingsPage() {
  const user = await requireUser();
  const since = new Date(new Date().getTime() - 24 * 60 * 60_000);
  const bookings = await prisma.booking.findMany({
    where: {
      organizerId: user.id,
      endAt: { gte: since },
    },
    include: { room: true },
    orderBy: { startAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">My bookings</h1>
        <p className="text-muted-foreground">
          Edit or cancel upcoming meetings you organize.
        </p>
      </div>

      <div className="space-y-4">
        {bookings.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>No bookings yet</CardTitle>
              <CardDescription>
                Find a free room from the rooms list and book it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LinkButton href="/rooms">Find a room</LinkButton>
            </CardContent>
          </Card>
        )}

        {bookings.map((b) => (
          <Card key={b.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle>{b.title}</CardTitle>
                <CardDescription>
                  {b.room.name} ·{" "}
                  <LocalTime value={b.startAt} pattern="EEE MMM d, h:mm a" /> –{" "}
                  <LocalTime value={b.endAt} pattern="h:mm a" />
                  {b.status === "CANCELLED" ? " · Cancelled" : ""}
                </CardDescription>
              </div>
              {b.status === "CONFIRMED" && b.endAt > new Date() && (
                <form
                  action={async () => {
                    "use server";
                    await cancelBooking(b.id);
                  }}
                >
                  <Button type="submit" variant="outline">
                    Cancel
                  </Button>
                </form>
              )}
            </CardHeader>
            {b.status === "CONFIRMED" && (
              <CardContent>
                <LinkButton
                  href={`/rooms/${b.room.slug}/book`}
                  variant="secondary"
                >
                  Rebook this room
                </LinkButton>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
