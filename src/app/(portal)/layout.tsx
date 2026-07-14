import { PortalHeader } from "@/features/dashboard/components/portal-header";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-atmosphere">
      <PortalHeader />
      {children}
    </div>
  );
}
