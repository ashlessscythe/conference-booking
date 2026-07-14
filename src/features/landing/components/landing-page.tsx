import { auth } from "@/lib/auth";
import {
  getDashboardSnapshot,
  getDefaultOrganizationId,
} from "@/features/rooms/queries";
import { LandingHero } from "@/features/landing/components/landing-hero";
import { LandingFeatures } from "@/features/landing/components/landing-features";
import { LandingCta } from "@/features/landing/components/landing-cta";

export async function LandingPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user);

  let bookHref = "/rooms";
  if (signedIn) {
    const orgId = await getDefaultOrganizationId();
    if (orgId) {
      const snap = await getDashboardSnapshot(orgId);
      const firstFree = snap.freeNow[0];
      if (firstFree) {
        bookHref = `/rooms/${firstFree.slug}/book`;
      }
    }
  }

  const primary = signedIn
    ? { href: bookHref, label: "Book a room" }
    : { href: "/login", label: "Sign in" };

  const secondary = signedIn
    ? { href: "/rooms", label: "View rooms" }
    : { href: "/rooms", label: "Browse rooms" };

  return (
    <div className="flex flex-col">
      <LandingHero
        primary={primary}
        secondary={secondary}
        signedIn={signedIn}
      />
      <LandingFeatures />
      <LandingCta primary={primary} secondary={secondary} />
    </div>
  );
}
