import type { NextConfig } from "next";

function hostFromUrl(value?: string | null) {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

/**
 * When a reverse proxy fronts the app, the browser Origin may differ from
 * x-forwarded-host. Allowlist public hosts via AUTH_URL / NEXT_PUBLIC_APP_URL
 * and optional SERVER_ACTIONS_ALLOWED_ORIGINS (comma-separated hostnames).
 */
const allowedOrigins = Array.from(
  new Set(
    [
      hostFromUrl(process.env.AUTH_URL),
      hostFromUrl(process.env.NEXT_PUBLIC_APP_URL),
      ...(process.env.SERVER_ACTIONS_ALLOWED_ORIGINS?.split(",") ?? []),
    ]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value)),
  ),
);

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
};

export default nextConfig;
