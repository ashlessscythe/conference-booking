import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { userHasMembership } from "@/lib/organizations";
import { getSignupIntent } from "@/lib/signup-intent";
import { completeOnboarding } from "@/features/organizations/actions";
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
import { FREE_ROOM_LIMIT } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

async function finishOnboarding(formData: FormData) {
  "use server";
  await completeOnboarding({
    name: formData.get("organizationName"),
  });
}

export default async function OnboardingPage() {
  const user = await requireUser();
  if (await userHasMembership(user.id)) {
    redirect("/rooms");
  }

  const intent = await getSignupIntent();

  // Cookie already has org name from signup — finish via route handler
  // (cookie deletes are not allowed during RSC render).
  if (intent?.organizationName) {
    redirect("/onboarding/complete");
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center px-4 py-10">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>Name your workspace</CardTitle>
          <CardDescription>
            You&apos;re signed in as {user.email}. Create an organization to
            manage up to {FREE_ROOM_LIMIT} rooms on the free plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={finishOnboarding} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="organizationName">Organization name</Label>
              <Input
                id="organizationName"
                name="organizationName"
                required
                className="h-12"
                placeholder="Acme Offices"
                defaultValue={intent?.organizationName ?? ""}
              />
            </div>
            <Button type="submit" className="h-12 w-full">
              Create workspace
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
