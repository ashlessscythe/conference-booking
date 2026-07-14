import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";

export async function PortalHeader() {
  const session = await auth();

  return (
    <header className="border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Conference Booking
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <LinkButton href="/" variant="ghost">
            Dashboard
          </LinkButton>
          <LinkButton href="/bookings" variant="ghost">
            My bookings
          </LinkButton>
          {(session?.user?.role === "ADMIN" ||
            session?.user?.role === "OWNER") && (
            <LinkButton href="/admin" variant="ghost">
              Admin
            </LinkButton>
          )}
          {session?.user ? (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <Button type="submit" variant="outline">
                Sign out
              </Button>
            </form>
          ) : (
            <LinkButton href="/login">Sign in</LinkButton>
          )}
        </nav>
      </div>
    </header>
  );
}
