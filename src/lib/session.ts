import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MembershipRole } from "@prisma/client";
import { redirect } from "next/navigation";

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
    redirect("/");
  }
  return {
    ...user,
    organizationId: user.organizationId,
    role: role as MembershipRole,
  };
}

export async function getOrgSettings(organizationId: string) {
  return prisma.systemSettings.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });
}
