"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/session";
import { slugify } from "@/lib/utils";
import {
  createOrganizationForOwner,
  userHasMembership,
} from "@/lib/organizations";
import {
  clearSignupIntent,
  getSignupIntent,
} from "@/lib/signup-intent";
import { unstable_update } from "@/lib/auth";

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
      planTier: "FREE",
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

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.AUTH_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

async function sendInviteEmail(input: {
  email: string;
  organizationName: string;
  inviteUrl: string;
  role: MembershipRole;
}) {
  const key = process.env.AUTH_RESEND_KEY;
  const from =
    process.env.EMAIL_FROM ?? "Conference Booking <onboarding@resend.dev>";
  const subject = `Join ${input.organizationName} on Conference Booking`;
  const text = [
    `You've been invited to ${input.organizationName} as ${input.role}.`,
    "",
    `Accept the invite: ${input.inviteUrl}`,
    "",
    "This link expires in 14 days.",
  ].join("\n");
  const html = `
    <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
      <p>You've been invited to <strong>${escapeHtml(input.organizationName)}</strong> as <strong>${escapeHtml(input.role)}</strong>.</p>
      <p><a href="${escapeHtml(input.inviteUrl)}" style="display:inline-block;padding:10px 16px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;">Accept invite</a></p>
      <p style="color:#555;font-size:14px;">Or open this link:<br /><a href="${escapeHtml(input.inviteUrl)}">${escapeHtml(input.inviteUrl)}</a></p>
      <p style="color:#777;font-size:13px;">This link expires in 14 days.</p>
    </div>
  `.trim();

  if (!key) {
    console.log("\n========== ORG INVITE ==========");
    console.log(`To: ${input.email}`);
    console.log(`URL: ${input.inviteUrl}`);
    console.log("================================\n");
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from,
    to: input.email,
    subject,
    text,
    html,
  });
  if (error) {
    console.error("Invite email failed:", error);
    console.log("\n========== ORG INVITE (fallback) ==========");
    console.log(`To: ${input.email}`);
    console.log(`URL: ${input.inviteUrl}`);
    console.log("===========================================\n");
    throw new Error(
      error.message || "Failed to send invite email. Check Resend / EMAIL_FROM.",
    );
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Invite by email (pending until accepted) or refresh an existing invite. */
export async function inviteOrAddMember(raw: unknown) {
  const admin = await requireAdmin();
  const data = memberSchema.parse(raw);
  const email = data.email.toLowerCase();

  if (data.role === "OWNER" && admin.role !== "OWNER") {
    throw new Error("Only owners can invite another owner.");
  }

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: admin.organizationId },
    select: { name: true },
  });

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    const existingMembership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: existingUser.id,
          organizationId: admin.organizationId,
        },
      },
    });
    if (existingMembership) {
      await prisma.membership.update({
        where: { id: existingMembership.id },
        data: { role: data.role },
      });
      revalidatePath("/admin/users");
      return { status: "updated" as const };
    }
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  const invite = await prisma.invitation.upsert({
    where: {
      organizationId_email: {
        organizationId: admin.organizationId,
        email,
      },
    },
    create: {
      organizationId: admin.organizationId,
      email,
      role: data.role,
      invitedById: admin.id,
      expiresAt,
      acceptedAt: null,
      token: crypto.randomUUID().replace(/-/g, ""),
    },
    update: {
      role: data.role,
      invitedById: admin.id,
      expiresAt,
      acceptedAt: null,
      token: crypto.randomUUID().replace(/-/g, ""),
    },
  });

  const inviteUrl = `${appUrl()}/invite/${invite.token}`;
  await sendInviteEmail({
    email,
    organizationName: org.name,
    inviteUrl,
    role: data.role,
  });

  revalidatePath("/admin/users");
  return { status: "invited" as const, inviteUrl };
}

export async function acceptInvitation(token: string) {
  const user = await requireUser();
  const invite = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: true },
  });

  if (!invite || invite.acceptedAt) {
    throw new Error("This invite is invalid or already used.");
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    throw new Error("This invite has expired. Ask an admin to send a new one.");
  }
  if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
    throw new Error(
      `Sign in as ${invite.email} to accept this invite (you are ${user.email}).`,
    );
  }

  await prisma.$transaction([
    prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: invite.organizationId,
        },
      },
      create: {
        userId: user.id,
        organizationId: invite.organizationId,
        role: invite.role,
      },
      update: { role: invite.role },
    }),
    prisma.invitation.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  revalidatePath("/admin/users");
  revalidatePath("/rooms");
  redirect("/rooms");
}

export async function completeOnboarding(raw: unknown) {
  const user = await requireUser();
  if (await userHasMembership(user.id)) {
    redirect("/rooms");
  }

  const intent = await getSignupIntent();
  const parsed = orgSchema.safeParse(
    raw ?? { name: intent?.organizationName },
  );
  const name =
    parsed.success ? parsed.data.name : intent?.organizationName?.trim();

  if (!name) {
    throw new Error("Organization name is required.");
  }

  const org = await createOrganizationForOwner({ userId: user.id, name });
  await clearSignupIntent();
  // Persist role/org on the JWT so edge middleware can authorize /admin.
  await unstable_update({
    user: {
      role: "OWNER",
      organizationId: org.id,
    },
  });
  revalidatePath("/rooms");
  revalidatePath("/admin");
  redirect("/admin/rooms");
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
