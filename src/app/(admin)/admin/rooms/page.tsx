import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import {
  createRoom,
  toggleRoomOutOfService,
} from "@/features/rooms/actions";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function createRoomAction(formData: FormData) {
  "use server";
  await createRoom({
    name: formData.get("name"),
    capacity: formData.get("capacity"),
    floor: formData.get("floor") || null,
    description: formData.get("description") || null,
  });
}

export default async function AdminRoomsPage() {
  const admin = await requireAdmin();
  const rooms = await prisma.room.findMany({
    where: { organizationId: admin.organizationId },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Rooms</h2>
        <p className="text-muted-foreground">
          Capacity, floors, and out-of-service toggles.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {rooms.map((room) => (
          <Card key={room.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>{room.name}</CardTitle>
                <CardDescription>
                  /{room.slug} · {room.capacity} seats
                  {room.floor ? ` · Floor ${room.floor}` : ""}
                  {room.outOfService ? " · Out of service" : ""}
                </CardDescription>
              </div>
              <LinkButton
                href={`/rooms/${room.slug}`}
                variant="outline"
                size="sm"
              >
                View
              </LinkButton>
            </CardHeader>
            <CardContent>
              <form
                action={async () => {
                  "use server";
                  await toggleRoomOutOfService(room.id);
                }}
              >
                <Button type="submit" variant="secondary">
                  {room.outOfService ? "Mark available" : "Mark out of service"}
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add room</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createRoomAction} className="grid gap-3 sm:grid-cols-2">
            <Input name="name" placeholder="Name" required className="h-11" />
            <Input
              name="capacity"
              type="number"
              min={1}
              defaultValue={6}
              placeholder="Capacity"
              required
              className="h-11"
            />
            <Input name="floor" placeholder="Floor" className="h-11" />
            <Textarea
              name="description"
              placeholder="Description"
              className="sm:col-span-2"
            />
            <Button type="submit" className="h-11 sm:col-span-2 sm:w-40">
              Create room
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
