import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";
import { MembershipRole } from "@prisma/client";
import {
  KIOSK_DEVICE_COOKIE,
  isKioskAllowedPath,
  kioskDeviceCookieOptions,
  parseDisplayDeviceToken,
} from "@/lib/kiosk-device";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role?: MembershipRole | null;
      organizationId?: string | null;
    };
  }
}

export const authConfig = {
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const displayToken = parseDisplayDeviceToken(path);

      // Opening a display URL stamps this browser as a kiosk device.
      if (displayToken) {
        const res = NextResponse.next();
        res.cookies.set(
          KIOSK_DEVICE_COOKIE,
          displayToken,
          kioskDeviceCookieOptions,
        );
        return res;
      }

      const lockedToken = request.cookies.get(KIOSK_DEVICE_COOKIE)?.value;
      if (lockedToken && !isKioskAllowedPath(path)) {
        const url = request.nextUrl.clone();
        url.pathname = `/display/${encodeURIComponent(lockedToken)}`;
        url.search = "";
        return NextResponse.redirect(url);
      }

      if (path.startsWith("/admin")) {
        const role = auth?.user?.role;
        return role === "ADMIN" || role === "OWNER";
      }
      if (path.startsWith("/bookings") || path.startsWith("/book")) {
        return !!auth?.user;
      }
      return true;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = (token.role as MembershipRole | null) ?? null;
        session.user.organizationId =
          (token.organizationId as string | null) ?? null;
      }
      return session;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.sub = user.id;
      }
      if (trigger === "update" && session) {
        token.role = session.role;
        token.organizationId = session.organizationId;
      }
      return token;
    },
  },
  session: { strategy: "jwt" },
  trustHost: true,
} satisfies NextAuthConfig;
