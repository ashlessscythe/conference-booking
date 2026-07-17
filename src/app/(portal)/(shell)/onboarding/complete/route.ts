import { redirect } from "next/navigation";
import { completeOnboarding } from "@/features/organizations/actions";
import { getSignupIntent } from "@/lib/signup-intent";

/**
 * Cookie writes (clearing signup_intent) are only allowed in a Route Handler
 * or Server Action — not during RSC render of /onboarding.
 */
export async function GET() {
  const intent = await getSignupIntent();
  if (!intent?.organizationName) {
    redirect("/onboarding");
  }
  await completeOnboarding({ name: intent.organizationName });
}
