import { requireAdmin, getOrgSettings } from "@/lib/session";
import { updateSettings } from "@/features/organizations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function saveSettings(formData: FormData) {
  "use server";
  await updateSettings({
    cleaningBufferMin: formData.get("cleaningBufferMin"),
    startingSoonMin: formData.get("startingSoonMin"),
    heartbeatTimeoutMin: formData.get("heartbeatTimeoutMin"),
  });
}

export default async function AdminSettingsPage() {
  const admin = await requireAdmin();
  const settings = await getOrgSettings(admin.organizationId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">System settings</h2>
        <p className="text-muted-foreground">
          Buffer and status windows used across portal, QR pages, and kiosks.
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Timing</CardTitle>
          <CardDescription>Values in minutes.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveSettings} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cleaningBufferMin">Cleaning buffer</Label>
              <Input
                id="cleaningBufferMin"
                name="cleaningBufferMin"
                type="number"
                min={0}
                max={60}
                defaultValue={settings.cleaningBufferMin}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startingSoonMin">Starting soon window</Label>
              <Input
                id="startingSoonMin"
                name="startingSoonMin"
                type="number"
                min={1}
                max={60}
                defaultValue={settings.startingSoonMin}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="heartbeatTimeoutMin">Device offline after</Label>
              <Input
                id="heartbeatTimeoutMin"
                name="heartbeatTimeoutMin"
                type="number"
                min={1}
                max={60}
                defaultValue={settings.heartbeatTimeoutMin}
                className="h-11"
              />
            </div>
            <Button type="submit" className="h-11">
              Save settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
