import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { inviteOrAddMember } from "@/features/organizations/actions";
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

async function addMemberAction(formData: FormData) {
  "use server";
  await inviteOrAddMember({
    email: formData.get("email"),
    name: formData.get("name") || undefined,
    role: formData.get("role") || "MEMBER",
  });
}

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  const members = await prisma.membership.findMany({
    where: { organizationId: admin.organizationId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Users</h2>
        <p className="text-muted-foreground">
          Memberships for this organization. They sign in via magic link.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {members.map((m) => (
          <Card key={m.id}>
            <CardHeader>
              <CardTitle className="text-lg">
                {m.user.name ?? m.user.email}
              </CardTitle>
              <CardDescription>
                {m.user.email} · {m.role}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add member</CardTitle>
          <CardDescription>
            Creates the user if needed and attaches a membership.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={addMemberAction} className="grid gap-3 sm:grid-cols-2">
            <Input name="email" type="email" placeholder="Email" required className="h-11" />
            <Input name="name" placeholder="Name" className="h-11" />
            <select
              name="role"
              className="h-11 rounded-lg border bg-background px-3"
              defaultValue="MEMBER"
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
              <option value="OWNER">Owner</option>
            </select>
            <Button type="submit" className="h-11">
              Add
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
