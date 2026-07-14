"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { slugify } from "@/lib/utils";

const orgSchema = z.object({
  name: z.string().min(1).max(80),
});

export async function createOrganization(raw: unknown) {
  const admin = await requireAdmin();
  const data = orgSchema.parse(raw);
  const slug = slugify(data.name);

  const org = await prisma.organization.create({
    data: {
      name: data.name,
      slug: `${slug}-${Date.now().toString(36)}`,
      settings: { create: {} },
      members: {
        create: {
          userId: admin.id,
          role: "OWNER",
        },
      },
    },
  });

  revalidatePath("/admin/organizations");
  return org;
}

const memberSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(MembershipRole),
  name: z.string().max(80).optional(),
});

export async function inviteOrAddMember(raw: unknown) {
  const admin = await requireAdmin();
  const data = memberSchema.parse(raw);

  const user = await prisma.user.upsert({
    where: { email: data.email.toLowerCase() },
    create: {
      email: data.email.toLowerCase(),
      name: data.name || data.email.split("@")[0],
    },
    update: data.name ? { name: data.name } : {},
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: admin.organizationId,
      },
    },
    create: {
      userId: user.id,
      organizationId: admin.organizationId,
      role: data.role,
    },
    update: { role: data.role },
  });

  revalidatePath("/admin/users");
}

export async function updateSettings(raw: unknown) {
  const admin = await requireAdmin();
  const schema = z.object({
    cleaningBufferMin: z.coerce.number().int().min(0).max(60),
    startingSoonMin: z.coerce.number().int().min(1).max(60),
    heartbeatTimeoutMin: z.coerce.number().int().min(1).max(60),
  });
  const data = schema.parse(raw);

  await prisma.systemSettings.upsert({
    where: { organizationId: admin.organizationId },
    create: { organizationId: admin.organizationId, ...data },
    update: data,
  });

  revalidatePath("/admin/settings");
  revalidatePath("/");
}
