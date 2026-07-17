import { CalendarClock, CreditCard, MonitorSmartphone, QrCode, Search, Users } from "lucide-react";
import { FREE_ROOM_LIMIT } from "@/lib/billing/plans";

const features = [
  {
    icon: Search,
    title: "Live availability",
    description:
      "See free rooms, meetings in progress, and what’s up next — without spreadsheet hunting.",
  },
  {
    icon: CalendarClock,
    title: "Book in seconds",
    description:
      "Pick a room, choose a slot, and confirm. Edit or cancel from your bookings list.",
  },
  {
    icon: QrCode,
    title: "QR room pages",
    description:
      "Scan a code at the door to open the room schedule and book from your phone.",
  },
  {
    icon: MonitorSmartphone,
    title: "Tablet displays",
    description:
      "Door-side kiosks show status and today’s agenda so hallways stay clear.",
  },
  {
    icon: Users,
    title: "Your team, your org",
    description:
      "Invite coworkers to your workspace. Each organization keeps its own rooms and bookings.",
  },
  {
    icon: CreditCard,
    title: "Free to start",
    description: `Up to ${FREE_ROOM_LIMIT} rooms free. Upgrade to Pro when you need the whole floor — just add your Stripe keys.`,
  },
] as const;

export function LandingFeatures() {
  return (
    <section className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Built for the floor
        </h2>
        <p className="mt-3 max-w-xl text-muted-foreground">
          One system for people booking rooms and devices showing who’s inside.
        </p>

        <ul className="mt-14 grid gap-12 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex gap-4">
              <span className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
