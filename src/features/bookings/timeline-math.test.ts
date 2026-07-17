import { describe, expect, it } from "vitest";
import {
  TOTAL_DAY_MINUTES,
  initialSelectionFromClick,
  nudgeSelectionEdge,
  resizeSelection,
  snapMinutes,
} from "@/features/bookings/timeline-math";

function dayAt(year: number, month: number, day: number) {
  return new Date(year, month, day, 0, 0, 0, 0);
}

describe("snapMinutes", () => {
  it("snaps to 15 and 30 minute grids", () => {
    expect(snapMinutes(22, 15)).toBe(15);
    expect(snapMinutes(23, 15)).toBe(30);
    expect(snapMinutes(44, 30)).toBe(30);
    expect(snapMinutes(46, 30)).toBe(60);
  });
});

describe("initialSelectionFromClick", () => {
  const base = dayAt(2026, 6, 17);

  it("creates a free fixed 30-minute slot on the half hour", () => {
    // Midpoint of 10:00–11:00 hour band ≈ 10:30
    const ratio = (2.5 * 60) / TOTAL_DAY_MINUTES;
    const { start, end } = initialSelectionFromClick({
      ratio,
      stepMin: 30,
      defaultDurationMin: 30,
      baseDay: base,
    });
    expect(start.getHours()).toBe(10);
    expect(start.getMinutes()).toBe(30);
    expect(end.getHours()).toBe(11);
    expect(end.getMinutes()).toBe(0);
  });

  it("creates a Pro default 30-minute slot snapped to 15 minutes", () => {
    const ratio = (2 * 60 + 20) / TOTAL_DAY_MINUTES; // ~10:20
    const { start, end } = initialSelectionFromClick({
      ratio,
      stepMin: 15,
      defaultDurationMin: 30,
      baseDay: base,
    });
    expect(start.getHours()).toBe(10);
    expect(start.getMinutes()).toBe(15);
    expect(end.getHours()).toBe(10);
    expect(end.getMinutes()).toBe(45);
  });

  it("clamps near end of day so duration still fits", () => {
    const { start, end } = initialSelectionFromClick({
      ratio: 0.99,
      stepMin: 15,
      defaultDurationMin: 30,
      baseDay: base,
    });
    expect(start.getHours()).toBe(19);
    expect(start.getMinutes()).toBe(30);
    expect(end.getHours()).toBe(20);
    expect(end.getMinutes()).toBe(0);
  });
});

describe("resizeSelection", () => {
  const base = dayAt(2026, 6, 17);
  const currentStart = new Date(2026, 6, 17, 10, 0, 0, 0);
  const currentEnd = new Date(2026, 6, 17, 10, 30, 0, 0);

  it("extends the end edge in 15-minute steps", () => {
    // 10:45 relative to day start (8:00) = 165 minutes
    const ratio = 165 / TOTAL_DAY_MINUTES;
    const next = resizeSelection({
      edge: "end",
      pointerRatio: ratio,
      stepMin: 15,
      minDurationMin: 15,
      currentStart,
      currentEnd,
      baseDay: base,
    });
    expect(next.end.getHours()).toBe(10);
    expect(next.end.getMinutes()).toBe(45);
    expect(next.start.getTime()).toBe(currentStart.getTime());
  });

  it("enforces minimum duration when dragging start later", () => {
    const ratio = 165 / TOTAL_DAY_MINUTES; // 10:45
    const next = resizeSelection({
      edge: "start",
      pointerRatio: ratio,
      stepMin: 15,
      minDurationMin: 15,
      currentStart,
      currentEnd,
      baseDay: base,
    });
    expect(next.start.getHours()).toBe(10);
    expect(next.start.getMinutes()).toBe(15);
    expect(next.end.getMinutes()).toBe(30);
  });

  it("clamps end to day boundary", () => {
    const next = resizeSelection({
      edge: "end",
      pointerRatio: 1.2,
      stepMin: 15,
      minDurationMin: 15,
      currentStart: new Date(2026, 6, 17, 19, 0, 0, 0),
      currentEnd: new Date(2026, 6, 17, 19, 30, 0, 0),
      baseDay: base,
    });
    expect(next.end.getHours()).toBe(20);
    expect(next.end.getMinutes()).toBe(0);
  });
});

describe("nudgeSelectionEdge", () => {
  const base = dayAt(2026, 6, 17);

  it("moves the end edge with keyboard step deltas", () => {
    const next = nudgeSelectionEdge({
      edge: "end",
      deltaSteps: 1,
      stepMin: 15,
      minDurationMin: 15,
      currentStart: new Date(2026, 6, 17, 10, 0, 0, 0),
      currentEnd: new Date(2026, 6, 17, 10, 30, 0, 0),
      baseDay: base,
    });
    expect(next.end.getMinutes()).toBe(45);
  });

  it("does not shrink below the minimum duration", () => {
    const next = nudgeSelectionEdge({
      edge: "end",
      deltaSteps: -2,
      stepMin: 15,
      minDurationMin: 15,
      currentStart: new Date(2026, 6, 17, 10, 0, 0, 0),
      currentEnd: new Date(2026, 6, 17, 10, 30, 0, 0),
      baseDay: base,
    });
    expect(next.end.getMinutes()).toBe(15);
  });
});
