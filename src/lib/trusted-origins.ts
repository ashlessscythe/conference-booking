/**
 * Hosts trusted for Server Actions when a reverse proxy public domain
 * differs from the platform hostname (Origin ≠ x-forwarded-host).
 *
 * Configure via AUTH_URL, NEXT_PUBLIC_APP_URL, and optional
 * SERVER_ACTIONS_ALLOWED_ORIGINS (comma-separated hostnames). No app
 * domains are hardcoded — keep those in deployment env only.
 */

export function hostFromUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

export function getTrustedActionOrigins(): string[] {
  return Array.from(
    new Set(
      [
        hostFromUrl(process.env.AUTH_URL),
        hostFromUrl(process.env.NEXT_PUBLIC_APP_URL),
        ...(process.env.SERVER_ACTIONS_ALLOWED_ORIGINS?.split(",") ?? []),
      ]
        .map((value) => value?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

/**
 * If Origin is a trusted public host but x-forwarded-host is the upstream
 * platform host, align x-forwarded-host so Next.js Server Actions CSRF
 * checks pass. Returns new Headers when a change is needed, otherwise null.
 */
export function alignForwardedHostForTrustedOrigin(
  headers: Headers,
): Headers | null {
  const origin = headers.get("origin");
  if (!origin) return null;

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }

  const trusted = getTrustedActionOrigins();
  if (!trusted.includes(originHost)) return null;

  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (!forwardedHost || forwardedHost.toLowerCase() === originHost) {
    return null;
  }

  const next = new Headers(headers);
  next.set("x-forwarded-host", originHost);
  return next;
}
