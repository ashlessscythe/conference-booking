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
  const [members, invitations] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId: admin.organizationId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: {
        organizationId: admin.organizationId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Users</h2>
        <p className="text-muted-foreground">
          Invite people to your organization. They sign in via magic link and
          accept the invite.
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

      {invitations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Pending invites</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {invitations.map((inv) => (
              <Card key={inv.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{inv.email}</CardTitle>
                  <CardDescription>
                    {inv.role} · expires{" "}
                    {inv.expiresAt.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Invite member</CardTitle>
          <CardDescription>
            Sends an email with an accept link (printed to the server console in
            local dev when Resend is unset).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={addMemberAction} className="grid gap-3 sm:grid-cols-2">
            <Input name="email" type="email" placeholder="Email" required className="h-11" />
            <Input name="name" placeholder="Name (optional)" className="h-11" />
            <select
              name="role"
              className="h-11 rounded-lg border bg-background px-3"
              defaultValue="MEMBER"
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
              {admin.role === "OWNER" && <option value="OWNER">Owner</option>}
            </select>
            <Button type="submit" className="h-11">
              Send invite
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
