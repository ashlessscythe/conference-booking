import type { NextConfig } from "next";
import { getTrustedActionOrigins } from "./src/lib/trusted-origins";

/**
 * Build-time allowlist (used when env is present during `next build`).
 * Runtime reverse-proxy mismatches are also handled in `src/proxy.ts`
 * using the same AUTH_URL / NEXT_PUBLIC_APP_URL / SERVER_ACTIONS_ALLOWED_ORIGINS.
 */
const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  experimental: {
    serverActions: {
      allowedOrigins: getTrustedActionOrigins(),
    },
  },
};

export default nextConfig;
