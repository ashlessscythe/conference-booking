import { ROOM_STATUS_META, type RoomStatusKey } from "@/lib/room-status";
import { cn } from "@/lib/utils";

export function StatusBadge({
  status,
  className,
  large = false,
}: {
  status: RoomStatusKey;
  className?: string;
  large?: boolean;
}) {
  const meta = ROOM_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-semibold",
        meta.bg,
        meta.text,
        large ? "px-4 py-2 text-lg" : "px-2.5 py-1 text-sm",
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

export function StatusBanner({
  status,
  children,
}: {
  status: RoomStatusKey;
  children?: React.ReactNode;
}) {
  const meta = ROOM_STATUS_META[status];
  return (
    <div
      className={cn(
        "flex w-full items-center justify-between px-8 py-6",
        meta.bg,
        meta.text,
      )}
    >
      <div className="text-5xl font-bold tracking-tight md:text-6xl">
        {meta.label}
      </div>
      {children}
    </div>
  );
}
