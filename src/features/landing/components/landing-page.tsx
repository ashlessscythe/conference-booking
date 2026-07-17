import { auth } from "@/lib/auth";
import { getDashboardSnapshot } from "@/features/rooms/queries";
import { getSessionOrganizationId } from "@/lib/session";
import { LandingHero } from "@/features/landing/components/landing-hero";
import { LandingFeatures } from "@/features/landing/components/landing-features";
import { LandingPricing } from "@/features/landing/components/landing-pricing";
import { LandingCta } from "@/features/landing/components/landing-cta";

export async function LandingPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user);

  let bookHref = "/rooms";
  if (signedIn) {
    const orgId = await getSessionOrganizationId();
    if (orgId) {
      const snap = await getDashboardSnapshot(orgId);
      const firstFree = snap.freeNow[0];
      if (firstFree) {
        bookHref = `/rooms/${firstFree.slug}/book`;
      }
    } else {
      bookHref = "/onboarding";
    }
  }

  const primary = signedIn
    ? session?.user?.organizationId
      ? { href: bookHref, label: "Book a room" }
      : { href: "/onboarding", label: "Finish setup" }
    : { href: "/signup", label: "Start free" };

  const secondary = signedIn
    ? { href: "/rooms", label: "View rooms" }
    : { href: "/login", label: "Sign in" };

  return (
    <div className="flex flex-col">
      <LandingHero
        primary={primary}
        secondary={secondary}
        signedIn={signedIn}
      />
      <LandingFeatures />
      <LandingPricing signupHref="/signup" signedIn={signedIn} />
      <LandingCta primary={primary} secondary={secondary} />
    </div>
  );
}
