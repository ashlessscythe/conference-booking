import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { KIOSK_DEVICE_COOKIE } from "@/lib/kiosk-device";

/** Clears kiosk lockdown so this browser can leave /display/*. */
export async function GET(request: Request) {
  const store = await cookies();
  store.delete(KIOSK_DEVICE_COOKIE);

  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/admin/devices";
  const dest = next.startsWith("/") ? next : "/admin/devices";

  return NextResponse.redirect(new URL(dest, request.url));
}
