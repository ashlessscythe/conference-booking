"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const THEMES = [
  { value: "day", label: "Day" },
  { value: "night", label: "Night" },
  { value: "corporate", label: "Corporate" },
  { value: "cyberpunk", label: "Cyberpunk" },
] as const;

function subscribe() {
  return () => {};
}

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  if (!mounted) {
    return (
      <div
        className={className}
        aria-hidden
        style={{ width: "7.5rem", height: "2rem" }}
      />
    );
  }

  return (
    <Select
      value={theme ?? "corporate"}
      onValueChange={(value) => {
        if (value) setTheme(value);
      }}
    >
      <SelectTrigger
        size="sm"
        className={className}
        aria-label="Color theme"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {THEMES.map((t) => (
          <SelectItem key={t.value} value={t.value}>
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
