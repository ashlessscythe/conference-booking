import { cookies } from "next/headers";

export const SIGNUP_INTENT_COOKIE = "signup_intent";

export type SignupIntent = {
  organizationName: string;
};

export async function setSignupIntent(intent: SignupIntent) {
  const store = await cookies();
  store.set(SIGNUP_INTENT_COOKIE, JSON.stringify(intent), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
}

export async function getSignupIntent(): Promise<SignupIntent | null> {
  const store = await cookies();
  const raw = store.get(SIGNUP_INTENT_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SignupIntent;
  } catch {
    return null;
  }
}

export async function clearSignupIntent() {
  const store = await cookies();
  store.delete(SIGNUP_INTENT_COOKIE);
}
