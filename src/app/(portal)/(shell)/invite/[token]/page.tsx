import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { acceptInvitation } from "@/features/organizations/actions";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: true },
  });

  if (!invite) notFound();

  const session = await auth();
  const now = new Date();
  const expired = invite.expiresAt.getTime() < now.getTime();
  const accepted = Boolean(invite.acceptedAt);

  if (session?.user?.id && !expired && !accepted) {
    if (session.user.email?.toLowerCase() === invite.email.toLowerCase()) {
      // Fall through to accept UI
    }
  }

  async function acceptAction() {
    "use server";
    await acceptInvitation(token);
  }

  if (accepted) {
    redirect("/rooms");
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center px-4 py-10">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>Join {invite.organization.name}</CardTitle>
          <CardDescription>
            Invited as <span className="font-medium">{invite.role}</span> ·{" "}
            {invite.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {expired ? (
            <p className="text-sm text-muted-foreground">
              This invite expired. Ask an admin to send a new one.
            </p>
          ) : !session?.user ? (
            <>
              <p className="text-sm text-muted-foreground">
                Sign in with <strong>{invite.email}</strong> to join this
                organization.
              </p>
              <LinkButton
                href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
                className="h-11 w-full"
              >
                Sign in to accept
              </LinkButton>
            </>
          ) : session.user.email?.toLowerCase() !==
            invite.email.toLowerCase() ? (
            <p className="text-sm text-muted-foreground">
              You&apos;re signed in as {session.user.email}. Sign out and use{" "}
              {invite.email} to accept.
            </p>
          ) : (
            <form action={acceptAction}>
              <Button type="submit" className="h-11 w-full">
                Accept invite
              </Button>
            </form>
          )}
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/" className="underline underline-offset-4">
              Back to home
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
