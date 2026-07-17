import { SignupForm } from "@/features/auth/components/signup-form";
import { FREE_ROOM_LIMIT } from "@/lib/billing/plans";

export default function SignupPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center px-4 py-10">
      <div className="w-full space-y-6">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Conference Booking
          </h1>
          <p className="mt-2 text-muted-foreground">
            Spin up a workspace in minutes. Free for {FREE_ROOM_LIMIT} rooms —
            Pro when you need the whole floor.
          </p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
