import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import {
  planLabel,
  resolveEffectivePlan,
  roomLimitForPlan,
} from "@/lib/billing/plans";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function OrganizationsPage() {
  const admin = await requireAdmin();
  const memberships = await prisma.membership.findMany({
    where: { userId: admin.id },
    include: {
      organization: {
        include: { _count: { select: { rooms: true, members: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const active = memberships.find(
    (m) => m.organizationId === admin.organizationId,
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Organization</h2>
        <p className="text-muted-foreground">
          Your workspace and any other orgs you belong to. Data is isolated per
          organization.
        </p>
      </div>

      {active && (
        <Card>
          <CardHeader>
            <CardTitle>{active.organization.name}</CardTitle>
            <CardDescription>
              Active · {planLabel(resolveEffectivePlan(active.organization))} · /
              {active.organization.slug}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {active.organization._count.rooms} /{" "}
            {roomLimitForPlan(resolveEffectivePlan(active.organization))} rooms ·{" "}
            {active.organization._count.members} people · your role:{" "}
            {active.role}
          </CardContent>
        </Card>
      )}

      {memberships.length > 1 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Other memberships</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {memberships
              .filter((m) => m.organizationId !== admin.organizationId)
              .map((m) => {
                const effective = resolveEffectivePlan(m.organization);
                return (
                  <Card key={m.id}>
                    <CardHeader>
                      <CardTitle>{m.organization.name}</CardTitle>
                      <CardDescription>
                        {planLabel(effective)} · {m.role} ·{" "}
                        {m.organization._count.rooms} rooms
                      </CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
