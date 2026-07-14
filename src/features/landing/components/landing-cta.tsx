import { LinkButton } from "@/components/link-button";

type Cta = { href: string; label: string };

export function LandingCta({
  primary,
  secondary,
}: {
  primary: Cta;
  secondary: Cta;
}) {
  return (
    <section className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 sm:flex-row sm:items-center sm:justify-between sm:py-24">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready when the room is
          </h2>
          <p className="mt-2 max-w-md text-muted-foreground">
            Start with live status, then book the next open slot.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <LinkButton href={primary.href} size="lg" className="h-12 px-6">
            {primary.label}
          </LinkButton>
          <LinkButton
            href={secondary.href}
            size="lg"
            variant="outline"
            className="h-12 px-6"
          >
            {secondary.label}
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
