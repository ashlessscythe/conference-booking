import { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";

export async function userHasMembership(userId: string) {
  const count = await prisma.membership.count({ where: { userId } });
  return count > 0;
}

export async function createOrganizationForOwner(input: {
  userId: string;
  name: string;
}) {
  const base = slugify(input.name) || "org";
  const slug = `${base}-${Date.now().toString(36)}`;

  return prisma.organization.create({
    data: {
      name: input.name.trim(),
      slug,
      planTier: "FREE",
      settings: { create: {} },
      members: {
        create: {
          userId: input.userId,
          role: MembershipRole.OWNER,
        },
      },
    },
  });
}

export async function assertOrgMembership(input: {
  userId: string;
  organizationId: string;
}) {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: input.userId,
        organizationId: input.organizationId,
      },
    },
  });
  if (!membership) {
    throw new Error("You are not a member of this organization.");
  }
  return membership;
}
