import { LinkButton } from "@/components/link-button";
import {
  FREE_ROOM_LIMIT,
  FREE_USER_LIMIT,
} from "@/lib/billing/plans";

export function LandingPricing({
  signupHref,
  signedIn,
}: {
  signupHref: string;
  signedIn: boolean;
}) {
  return (
    <section className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Simple pricing
        </h2>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Start free. Scale when your office grows.
        </p>

        <div className="mt-12 grid gap-10 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Free
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {FREE_ROOM_LIMIT} rooms · {FREE_USER_LIMIT} users
            </p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>Magic-link sign-in, live availability, QR pages, and tablet displays</li>
              <li>Fixed 30-minute meetings</li>
              <li>Up to {FREE_ROOM_LIMIT} rooms and {FREE_USER_LIMIT} users per workspace</li>
            </ul>
            {!signedIn && (
              <LinkButton href={signupHref} className="mt-6 h-11">
                Start free
              </LinkButton>
            )}
          </div>
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Pro
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              Unlimited rooms &amp; users
            </p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>Unlimited rooms and team seats</li>
              <li>15-minute scheduling granularity</li>
              <li>Custom meeting lengths with resize on the timeline</li>
              <li>Upgrade anytime from Admin → Billing</li>
            </ul>
            {!signedIn && (
              <LinkButton
                href={signupHref}
                variant="outline"
                className="mt-6 h-11"
              >
                Create workspace
              </LinkButton>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
