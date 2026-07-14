import { LoginForm } from "@/features/auth/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string;
    room?: string;
    start?: string;
    end?: string;
    title?: string;
    intent?: string;
  }>;
}) {
  const q = await searchParams;
  const room = q.room;
  const callbackUrl =
    q.callbackUrl ||
    (room
      ? `/rooms/${room}/book${q.title ? `?title=${encodeURIComponent(q.title)}` : ""}`
      : "/");

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center px-4 py-10">
      <div className="w-full space-y-6">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Conference Booking
          </h1>
          <p className="mt-2 text-muted-foreground">
            Sign in with a one-time magic link.
          </p>
        </div>
        <LoginForm
          callbackUrl={callbackUrl}
          room={room}
          start={q.start}
          end={q.end}
          title={q.title}
        />
      </div>
    </div>
  );
}
