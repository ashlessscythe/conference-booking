import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { inviteOrAddMember } from "@/features/organizations/actions";
import { isSeatLimitError } from "@/lib/billing/errors";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FREE_USER_LIMIT,
  canAddSeat,
  planLabel,
  resolveEffectivePlan,
  userLimitForPlan,
} from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

async function addMemberAction(formData: FormData) {
  "use server";
  try {
    await inviteOrAddMember({
      email: formData.get("email"),
      name: formData.get("name") || undefined,
      role: formData.get("role") || "MEMBER",
    });
  } catch (e) {
    if (isSeatLimitError(e)) {
      return;
    }
    throw e;
  }
}

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  const [members, invitations, org] = await Promise.all([
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
    prisma.organization.findUniqueOrThrow({
      where: { id: admin.organizationId },
      select: {
        planTier: true,
        stripeSubscriptionStatus: true,
        promoExpiresAt: true,
      },
    }),
  ]);

  const effective = resolveEffectivePlan(org);
  const seatCount = members.length + invitations.length;
  const seatLimit = userLimitForPlan(effective);
  const canInvite = canAddSeat({
    planTier: effective,
    currentSeatCount: seatCount,
  });
  const isFree = effective === "FREE";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Users</h2>
        <p className="text-muted-foreground">
          Invite people to your organization. They sign in via magic link and
          accept the invite.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {planLabel(effective)} plan: {seatCount} of{" "}
          {isFree ? FREE_USER_LIMIT : "unlimited"} seats used
          {isFree
            ? " (members + pending invites)."
            : ` (practical cap ${seatLimit}).`}
        </p>
        {isFree && !canInvite && (
          <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            You&apos;ve reached the free limit of {FREE_USER_LIMIT} users.{" "}
            <LinkButton
              href="/admin/billing"
              variant="link"
              className="h-auto p-0 text-amber-900 underline dark:text-amber-100"
            >
              Upgrade to Pro
            </LinkButton>{" "}
            for unlimited seats.
          </p>
        )}
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
                <CardContent>
                  <a
                    href={`/invite/${inv.token}`}
                    className="break-all text-sm text-sky-600 underline underline-offset-4 dark:text-sky-400"
                  >
                    /invite/{inv.token}
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Invite member</CardTitle>
          <CardDescription>
            {canInvite
              ? "Sends an email with an accept link (printed to the server console in local dev when Resend is unset)."
              : `Free plan includes ${FREE_USER_LIMIT} users. Upgrade to Pro to invite more.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canInvite ? (
            <form action={addMemberAction} className="grid gap-3 sm:grid-cols-2">
              <Input
                name="email"
                type="email"
                placeholder="Email"
                required
                className="h-11"
              />
              <Input
                name="name"
                placeholder="Name (optional)"
                className="h-11"
              />
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
          ) : (
            <LinkButton href="/admin/billing" className="h-11">
              Upgrade to Pro
            </LinkButton>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
