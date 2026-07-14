import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { requireAdmin, getOrgSettings } from "@/lib/session";
import {
  registerDevice,
  assignDeviceRoom,
  replaceDevice,
  setDeviceEnabled,
} from "@/features/devices/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function registerAction(formData: FormData) {
  "use server";
  await registerDevice({
    name: formData.get("name"),
    roomId: formData.get("roomId") || null,
  });
}

export default async function AdminDevicesPage() {
  const admin = await requireAdmin();
  const settings = await getOrgSettings(admin.organizationId);
  const timeoutMs = settings.heartbeatTimeoutMin * 60_000;

  const [devices, rooms] = await Promise.all([
    prisma.kioskDevice.findMany({
      where: { organizationId: admin.organizationId },
      include: { room: true },
    }),
    prisma.room.findMany({
      where: { organizationId: admin.organizationId },
      orderBy: { name: "asc" },
    }),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const nowMs = new Date().getTime();

  const withQr = await Promise.all(
    devices.map(async (d) => {
      const displayUrl = `${appUrl}/display/${d.deviceToken}`;
      const qrDataUrl = await QRCode.toDataURL(displayUrl, {
        width: 320,
        margin: 1,
        errorCorrectionLevel: "M",
      });
      return { d, displayUrl, qrDataUrl };
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Tablet devices</h2>
        <p className="text-muted-foreground">
          Register, assign, replace, or disable kiosk tablets without changing room config.
          Scan the QR on a tablet to open kiosk mode.
        </p>
      </div>

      <div className="space-y-4">
        {withQr.map(({ d, displayUrl, qrDataUrl }) => {
          const isOnline =
            d.enabled &&
            d.lastHeartbeat &&
            nowMs - d.lastHeartbeat.getTime() < timeoutMs;
          return (
            <Card key={d.id}>
              <CardHeader>
                <CardTitle>{d.name}</CardTitle>
                <CardDescription>
                  {d.room?.name ?? "Unassigned"} ·{" "}
                  {!d.enabled ? "Disabled" : isOnline ? "Online" : "Offline"}
                  {d.lastHeartbeat
                    ? ` · heartbeat ${formatDistanceToNow(d.lastHeartbeat, { addSuffix: true })}`
                    : " · no heartbeat"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col items-start gap-4 rounded-lg border bg-white p-3 sm:flex-row">
                  <Image
                    src={qrDataUrl}
                    alt={`Kiosk QR for ${d.name}`}
                    width={160}
                    height={160}
                    unoptimized
                    className="shrink-0 rounded-lg border bg-white p-2"
                  />
                  <div className="min-w-0 space-y-1 text-sm">
                    <div className="font-medium">Kiosk QR · Display URL</div>
                    <p className="text-muted-foreground">
                      Point the tablet camera at this code to open kiosk mode.
                    </p>
                    <Link
                      className="break-all text-blue-700 hover:underline"
                      href={`/display/${d.deviceToken}`}
                    >
                      {displayUrl}
                    </Link>
                  </div>
                </div>

                <form
                  action={async (fd) => {
                    "use server";
                    const roomId = String(fd.get("roomId") || "");
                    await assignDeviceRoom(d.id, roomId || null);
                  }}
                  className="flex flex-col gap-2 sm:flex-row"
                >
                  <select
                    name="roomId"
                    defaultValue={d.roomId ?? ""}
                    className="h-11 flex-1 rounded-lg border bg-background px-3"
                  >
                    <option value="">Unassigned</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" className="h-11">
                    Assign room
                  </Button>
                </form>

                <div className="flex flex-wrap gap-2">
                  <form
                    action={async () => {
                      "use server";
                      await replaceDevice(d.id);
                    }}
                  >
                    <Button type="submit" variant="outline">
                      Replace tablet
                    </Button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await setDeviceEnabled(d.id, !d.enabled);
                    }}
                  >
                    <Button type="submit" variant="secondary">
                      {d.enabled ? "Disable" : "Enable"}
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Register device</CardTitle>
          <CardDescription>
            Generates a unique device token and optional room assignment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={registerAction} className="grid gap-3 sm:grid-cols-2">
            <Input name="name" placeholder="Device name" required className="h-11" />
            <select name="roomId" className="h-11 rounded-lg border bg-background px-3">
              <option value="">Assign later</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <Button type="submit" className="h-11 sm:col-span-2 sm:w-48">
              Register
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
