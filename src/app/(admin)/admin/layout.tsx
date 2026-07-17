import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";
import { ThemeSwitcher } from "@/components/theme-switcher";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/organizations", label: "Organization" },
  { href: "/admin/rooms", label: "Rooms" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/devices", label: "Tablet Devices" },
  { href: "/admin/qr", label: "QR Codes" },
  { href: "/admin/settings", label: "System Settings" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-atmosphere">
      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-6 space-y-6">
            <div>
              <Link href="/" className="text-sm text-muted-foreground hover:underline">
                ← Portal
              </Link>
              <h1 className="mt-2 text-xl font-semibold tracking-tight">
                Admin
              </h1>
            </div>
            <nav className="flex flex-col gap-1">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-card hover:text-foreground",
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <ThemeSwitcher />
          </div>
        </aside>
        <div className="min-w-0 flex-1 space-y-6">{children}</div>
      </div>
    </div>
  );
}
