"use server";

import { signIn } from "@/lib/auth";
import { setBookingIntent } from "@/lib/booking-intent";
import { setSignupIntent } from "@/lib/signup-intent";
import { z } from "zod";

export async function requestMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/");
  const room = formData.get("room");
  const start = formData.get("start");
  const end = formData.get("end");
  const title = formData.get("title");

  if (room) {
    await setBookingIntent({
      roomSlug: String(room),
      startAt: start ? String(start) : undefined,
      endAt: end ? String(end) : undefined,
      title: title ? String(title) : undefined,
      returnTo: callbackUrl,
    });
  }

  await signIn("resend", {
    email,
    redirectTo: callbackUrl,
  });
}

const signupSchema = z.object({
  email: z.string().email(),
  organizationName: z.string().min(1).max(80),
});

export async function requestSignupMagicLink(formData: FormData) {
  const data = signupSchema.parse({
    email: formData.get("email"),
    organizationName: formData.get("organizationName"),
  });

  await setSignupIntent({ organizationName: data.organizationName.trim() });

  await signIn("resend", {
    email: data.email,
    redirectTo: "/onboarding",
  });
}
