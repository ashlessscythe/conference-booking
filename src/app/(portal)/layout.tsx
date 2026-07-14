import { PortalHeader } from "@/features/dashboard/components/portal-header";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#e8eef5,_#f8fafc_55%)]">
      <PortalHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
