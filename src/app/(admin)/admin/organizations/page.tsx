import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { createOrganization } from "@/features/organizations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const orgs = await prisma.organization.findMany({
    include: { _count: { select: { rooms: true, members: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Organizations</h2>
        <p className="text-muted-foreground">
          Active org for your session:{" "}
          <code className="rounded bg-muted px-1.5">{admin.organizationId}</code>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {orgs.map((o) => (
          <Card key={o.id}>
            <CardHeader>
              <CardTitle>{o.name}</CardTitle>
              <CardDescription>
                /{o.slug} · {o._count.rooms} rooms · {o._count.members} people
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create organization</CardTitle>
          <CardDescription>You become the owner.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData) => {
              "use server";
              await createOrganization({ name: formData.get("name") });
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <Input name="name" placeholder="Organization name" required className="h-11" />
            <Button type="submit" className="h-11">
              Create
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
