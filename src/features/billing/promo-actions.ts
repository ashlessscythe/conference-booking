"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { redirect } from "next/navigation";
import { requireAdmin, requireUser } from "@/lib/session";
import { isPlatformOwnerEmail } from "@/lib/billing/promo";
import {
  createPromoCodeRecord,
  redeemPromoCodeForOrganization,
} from "@/lib/billing/promo-service";
import { prisma } from "@/lib/db";

function assertPlatformOwner(email: string | null | undefined) {
  if (!isPlatformOwnerEmail(email)) {
    throw new Error(
      "Only platform owners can manage promo codes. Set PLATFORM_OWNER_EMAILS.",
    );
  }
}

export async function createPromoCode(raw: unknown) {
  const user = await requireUser();
  assertPlatformOwner(user.email);

  const schema = z.object({
    code: z.string().min(3).max(32),
    kind: z.enum(["FREE_MONTHS", "PERCENT_OFF", "AMOUNT_OFF"]),
    freeMonths: z.coerce.number().int().optional().nullable(),
    percentOff: z.coerce.number().int().optional().nullable(),
    amountOffCents: z.coerce.number().int().optional().nullable(),
    durationMonths: z.coerce.number().int().optional().nullable(),
    maxRedemptions: z.coerce.number().int().optional().nullable(),
    expiresAt: z.string().optional().nullable(),
    note: z.string().max(200).optional().nullable(),
  });
  const data = schema.parse(raw);

  await createPromoCodeRecord({
    code: data.code,
    kind: data.kind,
    freeMonths: data.freeMonths,
    percentOff: data.percentOff,
    amountOffCents: data.amountOffCents,
    durationMonths: data.durationMonths,
    maxRedemptions: data.maxRedemptions || null,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    note: data.note || null,
    createdByUserId: user.id,
  });

  revalidatePath("/admin/promos");
}

export async function setPromoActive(id: string, active: boolean) {
  const user = await requireUser();
  assertPlatformOwner(user.email);
  await prisma.promoCode.update({
    where: { id },
    data: { active },
  });
  revalidatePath("/admin/promos");
}

export async function redeemPromoCode(raw: unknown) {
  const admin = await requireAdmin();
  const schema = z.object({
    code: z.string().min(1).max(40),
  });
  const data = schema.parse(raw);

  const result = await redeemPromoCodeForOrganization({
    code: data.code,
    organizationId: admin.organizationId,
    userId: admin.id,
  });

  revalidatePath("/admin/billing");
  revalidatePath("/admin/rooms");
  revalidatePath("/rooms");
  return result;
}

export async function redeemPromoCodeForm(formData: FormData) {
  await redeemPromoCode({ code: formData.get("code") });
  redirect("/admin/billing?promo=1");
}
