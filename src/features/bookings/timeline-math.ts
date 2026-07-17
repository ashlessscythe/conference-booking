export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 20;
export const TOTAL_DAY_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;

export type ResizeEdge = "start" | "end";

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function snapMinutes(minutes: number, stepMin: number) {
  return Math.round(minutes / stepMin) * stepMin;
}

export function minutesFromRatio(ratio: number) {
  return clamp(ratio, 0, 1) * TOTAL_DAY_MINUTES;
}

export function offsetMinutesFromDate(date: Date) {
  const minutes =
    date.getHours() * 60 + date.getMinutes() - DAY_START_HOUR * 60;
  return clamp(minutes, 0, TOTAL_DAY_MINUTES);
}

export function dateFromDayOffset(baseDay: Date, offsetMin: number) {
  const hours = DAY_START_HOUR + Math.floor(offsetMin / 60);
  const minutes = offsetMin % 60;
  const result = new Date(baseDay);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function initialSelectionFromClick(input: {
  ratio: number;
  stepMin: number;
  defaultDurationMin: number;
  baseDay: Date;
}): { start: Date; end: Date } {
  const raw = minutesFromRatio(input.ratio);
  let startOffset = snapMinutes(raw, input.stepMin);
  startOffset = clamp(
    startOffset,
    0,
    TOTAL_DAY_MINUTES - input.defaultDurationMin,
  );
  const endOffset = startOffset + input.defaultDurationMin;
  return {
    start: dateFromDayOffset(input.baseDay, startOffset),
    end: dateFromDayOffset(input.baseDay, endOffset),
  };
}

export function resizeSelection(input: {
  edge: ResizeEdge;
  pointerRatio: number;
  stepMin: number;
  minDurationMin: number;
  currentStart: Date;
  currentEnd: Date;
  baseDay: Date;
}): { start: Date; end: Date } {
  const startOffset = offsetMinutesFromDate(input.currentStart);
  const endOffset = offsetMinutesFromDate(input.currentEnd);
  const pointerOffset = snapMinutes(
    minutesFromRatio(input.pointerRatio),
    input.stepMin,
  );

  if (input.edge === "start") {
    const maxStart = endOffset - input.minDurationMin;
    const nextStart = clamp(pointerOffset, 0, maxStart);
    return {
      start: dateFromDayOffset(input.baseDay, nextStart),
      end: dateFromDayOffset(input.baseDay, endOffset),
    };
  }

  const minEnd = startOffset + input.minDurationMin;
  const nextEnd = clamp(pointerOffset, minEnd, TOTAL_DAY_MINUTES);
  return {
    start: dateFromDayOffset(input.baseDay, startOffset),
    end: dateFromDayOffset(input.baseDay, nextEnd),
  };
}

export function nudgeSelectionEdge(input: {
  edge: ResizeEdge;
  deltaSteps: number;
  stepMin: number;
  minDurationMin: number;
  currentStart: Date;
  currentEnd: Date;
  baseDay: Date;
}): { start: Date; end: Date } {
  const delta = input.deltaSteps * input.stepMin;
  const startOffset = offsetMinutesFromDate(input.currentStart);
  const endOffset = offsetMinutesFromDate(input.currentEnd);

  if (input.edge === "start") {
    const nextStart = clamp(
      startOffset + delta,
      0,
      endOffset - input.minDurationMin,
    );
    return {
      start: dateFromDayOffset(input.baseDay, nextStart),
      end: dateFromDayOffset(input.baseDay, endOffset),
    };
  }

  const nextEnd = clamp(
    endOffset + delta,
    startOffset + input.minDurationMin,
    TOTAL_DAY_MINUTES,
  );
  return {
    start: dateFromDayOffset(input.baseDay, startOffset),
    end: dateFromDayOffset(input.baseDay, nextEnd),
  };
}
