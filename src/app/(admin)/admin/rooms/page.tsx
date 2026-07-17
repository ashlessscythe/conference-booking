import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import {
  createRoom,
  toggleRoomOutOfService,
} from "@/features/rooms/actions";
import { isRoomLimitError } from "@/lib/billing/errors";
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
import {
  FREE_ROOM_LIMIT,
  canCreateRoom,
  planLabel,
  resolveEffectivePlan,
  roomLimitForPlan,
} from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

async function createRoomAction(formData: FormData) {
  "use server";
  try {
    await createRoom({
      name: formData.get("name"),
      capacity: formData.get("capacity"),
      floor: formData.get("floor") || null,
      description: formData.get("description") || null,
    });
  } catch (e) {
    if (isRoomLimitError(e)) {
      return;
    }
    throw e;
  }
}

export default async function AdminRoomsPage() {
  const admin = await requireAdmin();
  const [rooms, org] = await Promise.all([
    prisma.room.findMany({
      where: { organizationId: admin.organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.organization.findUniqueOrThrow({
      where: { id: admin.organizationId },
      select: {
        planTier: true,
        name: true,
        stripeSubscriptionStatus: true,
        promoExpiresAt: true,
      },
    }),
  ]);

  const effective = resolveEffectivePlan(org);
  const limit = roomLimitForPlan(effective);
  const atLimit = !canCreateRoom({
    planTier: effective,
    currentRoomCount: rooms.length,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Rooms</h2>
        <p className="text-muted-foreground">
          Capacity, floors, and out-of-service toggles.{" "}
          <span className="font-medium text-foreground">
            {planLabel(effective)} plan · {rooms.length}/{limit} rooms
          </span>
        </p>
      </div>

      {effective === "FREE" && (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          Free workspaces include {FREE_ROOM_LIMIT} rooms. You&apos;re using{" "}
          {rooms.length} of {FREE_ROOM_LIMIT}.
          {atLimit
            ? " "
            : " Add rooms below, or "}
          <a href="/admin/billing" className="underline underline-offset-4">
            {atLimit ? "Upgrade to Pro" : "upgrade anytime"}
          </a>
          {atLimit ? " to add more." : " from Billing."}
        </p>
      )}

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
          <CardDescription>
            {atLimit
              ? effective === "FREE"
                ? `You've reached the free limit of ${FREE_ROOM_LIMIT} rooms.`
                : `Room limit of ${limit} reached.`
              : `Create a room for ${org.name}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
            {atLimit ? (
            <p className="text-sm text-muted-foreground">
              {effective === "FREE" ? (
                <>
                  <a
                    href="/admin/billing"
                    className="underline underline-offset-4"
                  >
                    Upgrade or redeem a promo
                  </a>{" "}
                  to unlock more rooms, or remove a room to stay within the free
                  limit.
                </>
              ) : (
                "Remove a room before adding another."
              )}
            </p>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
