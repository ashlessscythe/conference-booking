import Link from "next/link";
import { LinkButton } from "@/components/link-button";

export default function CheckEmailPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-semibold">Check your email</h1>
      <p className="text-muted-foreground">
        Click the magic link we sent to finish signing in.
      </p>
      <LinkButton href="/login" variant="outline">
        Back to sign in
      </LinkButton>
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        Home
      </Link>
    </div>
  );
}
