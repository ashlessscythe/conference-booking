import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { alignForwardedHostForTrustedOrigin } from "@/lib/trusted-origins";

/**
 * Next.js 16 proxy (replaces deprecated middleware.ts).
 * Auth gates and kiosk_device lockdown live in authConfig.callbacks.authorized.
 * Also aligns x-forwarded-host for trusted public origins behind a reverse proxy.
 */
const { auth } = NextAuth(authConfig);

export const proxy = auth((req) => {
  const headers = alignForwardedHostForTrustedOrigin(req.headers);
  if (headers) {
    return NextResponse.next({
      request: { headers },
    });
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
