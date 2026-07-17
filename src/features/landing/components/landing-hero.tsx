import { LinkButton } from "@/components/link-button";

type Cta = { href: string; label: string };

export function LandingHero({
  primary,
  secondary,
  signedIn,
}: {
  primary: Cta;
  secondary: Cta;
  signedIn: boolean;
}) {
  return (
    <section className="relative isolate min-h-[calc(100svh-4rem)] overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-atmosphere animate-gradient-shift"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-background to-transparent"
      />

      <div className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl flex-col justify-center px-4 py-16 sm:py-20">
        <p className="animate-fade-up text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
          Conference Booking
        </p>
        <h1 className="animate-fade-up-delay mt-5 max-w-2xl text-2xl font-medium tracking-tight sm:text-3xl md:text-4xl">
          <span className="text-gradient">Rooms that stay available.</span>
        </h1>
        <p className="animate-fade-up-delay-2 mt-5 max-w-lg text-base text-muted-foreground sm:text-lg">
          {signedIn
            ? "See what's free now, book in a few taps, and keep the floor moving."
            : "Live availability, fast booking, and room displays. Start free with 2 rooms — upgrade when your office grows."}
        </p>
        <div className="animate-fade-up-delay-2 mt-9 flex flex-wrap gap-3">
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
