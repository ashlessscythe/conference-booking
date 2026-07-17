import { NextResponse } from "next/server";
import { clearKioskDeviceCookie } from "@/lib/kiosk-device";

/** Clears kiosk lockdown so this browser can leave /display/*. */
export async function GET(request: Request) {
  await clearKioskDeviceCookie();

  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/admin/devices";
  const dest = next.startsWith("/") ? next : "/admin/devices";

  return NextResponse.redirect(new URL(dest, request.url));
}
