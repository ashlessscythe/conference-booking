import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { regenerateRoomQr } from "@/features/rooms/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminQrPage() {
  const admin = await requireAdmin();
  const rooms = await prisma.room.findMany({
    where: { organizationId: admin.organizationId },
    orderBy: { name: "asc" },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const withQr = await Promise.all(
    rooms.map(async (room) => {
      const url = `${appUrl}/rooms/${room.slug}?v=${room.qrVersion}`;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 320,
        margin: 1,
        errorCorrectionLevel: "M",
      });
      return { room, url, dataUrl };
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">QR codes</h2>
        <p className="text-muted-foreground">
          Mount these outside rooms. Regenerating invalidates old prints via
          version bump.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {withQr.map(({ room, url, dataUrl }) => (
          <Card key={room.id}>
            <CardHeader>
              <CardTitle>{room.name}</CardTitle>
              <CardDescription>
                Version {room.qrVersion} ·{" "}
                <Link href={`/rooms/${room.slug}`} className="hover:underline">
                  Open room page
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-4 sm:flex-row">
              <Image
                src={dataUrl}
                alt={`QR for ${room.name}`}
                width={160}
                height={160}
                unoptimized
                className="rounded-lg border bg-white p-2"
              />
              <div className="space-y-3">
                <p className="break-all text-sm text-muted-foreground">{url}</p>
                <form
                  action={async () => {
                    "use server";
                    await regenerateRoomQr(room.id);
                  }}
                >
                  <Button type="submit" variant="outline">
                    Regenerate QR
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
