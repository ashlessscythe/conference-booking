"use client";

import { format } from "date-fns";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * Renders a stored timestamp formatted in the viewer's local timezone.
 *
 * Bookings are stored as absolute instants, so formatting must happen on the
 * client — the server would otherwise format in its own timezone (e.g. UTC),
 * which is inconsistent with the client-rendered surfaces (booking form,
 * kiosk). Until the component has hydrated we render a tz-neutral placeholder
 * so the server HTML and the first client render match (no hydration warning);
 * the localized value appears immediately after hydration.
 */
export function LocalTime({
  value,
  pattern,
}: {
  value: string | Date;
  pattern: string;
}) {
  const hydrated = useHydrated();

  if (!hydrated) return null;
  return <>{format(new Date(value), pattern)}</>;
}
