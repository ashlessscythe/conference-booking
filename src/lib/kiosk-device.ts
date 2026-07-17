import { cookies } from "next/headers";

export const KIOSK_DEVICE_COOKIE = "kiosk_device";

/** Rolling TTL — refreshed on each /display/{token} visit. */
export const KIOSK_DEVICE_MAX_AGE_SEC = 60 * 60 * 12;

export const kioskDeviceCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: KIOSK_DEVICE_MAX_AGE_SEC,
  secure: process.env.NODE_ENV === "production",
};

/** Drop kiosk lockdown (e.g. after portal sign-out in the same browser). */
export async function clearKioskDeviceCookie() {
  const store = await cookies();
  store.delete(KIOSK_DEVICE_COOKIE);
}

/** Path segment after /display/ — reject empty or path-traversal-looking values. */
export function parseDisplayDeviceToken(pathname: string): string | null {
  const match = pathname.match(/^\/display\/([^/]+)$/);
  if (!match) return null;
  const token = match[1];
  // Reserved under /display/* (not device tokens).
  if (!token || token === "exit" || token.includes("..")) return null;
  try {
    return decodeURIComponent(token);
  } catch {
    return null;
  }
}

export function isKioskAllowedPath(pathname: string): boolean {
  return (
    pathname === "/display" ||
    pathname === "/display/exit" ||
    pathname.startsWith("/display/") ||
    pathname.startsWith("/api/kiosk/")
  );
}
