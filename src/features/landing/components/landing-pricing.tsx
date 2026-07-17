import { LinkButton } from "@/components/link-button";
import { FREE_ROOM_LIMIT } from "@/lib/billing/plans";

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
          Start free. Scale when your office grows — billing is Stripe-ready.
        </p>

        <div className="mt-12 grid gap-10 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Free
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {FREE_ROOM_LIMIT} rooms
            </p>
            <p className="mt-3 text-muted-foreground">
              Magic-link sign-in, live availability, QR pages, and tablet
              displays for a small office.
            </p>
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
              Unlimited rooms
            </p>
            <p className="mt-3 text-muted-foreground">
              Unlock more rooms when you outgrow free. Connect Stripe in your
              environment and upgrade from Admin → Billing.
            </p>
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
