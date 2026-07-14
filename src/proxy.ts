import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

/**
 * Next.js 16 proxy (replaces deprecated middleware.ts).
 * Auth gates and kiosk_device lockdown live in authConfig.callbacks.authorized.
 */
export const proxy = NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
