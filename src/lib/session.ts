import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MembershipRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { isPlatformOwnerEmail } from "@/lib/billing/promo";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  const role = user.role;
  if (role !== "ADMIN" && role !== "OWNER") {
    redirect("/");
  }
  if (!user.organizationId) {
    redirect("/onboarding");
  }
  return {
    ...user,
    organizationId: user.organizationId,
    role: role as MembershipRole,
  };
}

export async function requirePlatformOwner() {
  const user = await requireUser();
  if (!isPlatformOwnerEmail(user.email)) {
    redirect("/admin");
  }
  return user;
}

/** Active org from the session, or null if the user has not joined one yet. */
export async function getSessionOrganizationId() {
  const session = await auth();
  return session?.user?.organizationId ?? null;
}

export async function requireOrganizationId() {
  const orgId = await getSessionOrganizationId();
  if (!orgId) {
    const session = await auth();
    if (!session?.user?.id) {
      redirect("/login");
    }
    redirect("/onboarding");
  }
  return orgId;
}

export async function getOrgSettings(organizationId: string) {
  return prisma.systemSettings.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });
}
