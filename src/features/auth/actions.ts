"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { setBookingIntent } from "@/lib/booking-intent";
import { setSignupIntent } from "@/lib/signup-intent";
import { z } from "zod";

/** Next.js redirect() throws; must not be treated as a send failure. */
function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function magicLinkFailureMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/only send testing emails|only send to your own/i.test(raw)) {
    return "Email delivery is in Resend testing mode and can only send to the account owner's verified address. Verify a sending domain in Resend, or sign in with that address.";
  }
  if (/invalid.*(email|to)|email.*(invalid|not allowed)/i.test(raw)) {
    return "That email address was rejected by the mail provider. Use a real inbox you can open.";
  }
  if (/Resend error/i.test(raw)) {
    return "We couldn't send a magic link right now. Check EMAIL_FROM / Resend domain settings, then try again.";
  }
  return "We couldn't send a magic link. Check the email address and try again.";
}

async function sendMagicLink(input: {
  email: string;
  redirectTo: string;
}) {
  try {
    await signIn("resend", {
      email: input.email,
      redirectTo: input.redirectTo,
    });
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    console.error("Magic link send failed:", error);
    redirect(
      `/login/check-email?error=${encodeURIComponent(magicLinkFailureMessage(error))}`,
    );
  }
}

export async function requestMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const callbackUrl = String(formData.get("callbackUrl") ?? "/");
  const room = formData.get("room");
  const start = formData.get("start");
  const end = formData.get("end");
  const title = formData.get("title");

  if (!email) {
    redirect(
      `/login/check-email?error=${encodeURIComponent("Enter an email address.")}`,
    );
  }

  if (room) {
    await setBookingIntent({
      roomSlug: String(room),
      startAt: start ? String(start) : undefined,
      endAt: end ? String(end) : undefined,
      title: title ? String(title) : undefined,
      returnTo: callbackUrl,
    });
  }

  await sendMagicLink({ email, redirectTo: callbackUrl });
}

const signupSchema = z.object({
  email: z.string().email(),
  organizationName: z.string().min(1).max(80),
});

export async function requestSignupMagicLink(formData: FormData) {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    organizationName: formData.get("organizationName"),
  });

  if (!parsed.success) {
    redirect(
      `/login/check-email?error=${encodeURIComponent("Enter a valid email and organization name.")}`,
    );
  }

  const data = parsed.data;
  await setSignupIntent({ organizationName: data.organizationName.trim() });
  await sendMagicLink({
    email: data.email.trim(),
    redirectTo: "/onboarding",
  });
}
