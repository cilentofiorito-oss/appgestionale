import { promises as fs } from "fs";
import path from "path";
import { DateTime } from "luxon";

export const TIME_ZONE = "Europe/Rome";

export type BusinessSettings = {
  slotIntervalMin: 15 | 30;
  minAdvanceMin: number;
  closedWeekdays: number[];
  holidays: string[];
  morningEnabled: boolean;
  morningOpen: string;
  morningClose: string;
  afternoonEnabled: boolean;
  afternoonOpen: string;
  afternoonClose: string;
};

export const DEFAULT_SETTINGS: BusinessSettings = {
  slotIntervalMin: 15,
  minAdvanceMin: 60,
  closedWeekdays: [1, 7],
  holidays: [],
  morningEnabled: true,
  morningOpen: "09:00",
  morningClose: "13:00",
  afternoonEnabled: true,
  afternoonOpen: "15:30",
  afternoonClose: "20:00",
};

const SETTINGS_DIR = path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(SETTINGS_DIR, "business-settings.json");

function uniqueIsoDates(items: string[]) {
  return Array.from(
    new Set(
      items
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item))
    )
  ).sort();
}

function sanitizeWeekdays(days: unknown): number[] {
  const raw = Array.isArray(days) ? days : [];
  return Array.from(
    new Set(
      raw
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
    )
  ).sort((a, b) => a - b);
}

function sanitizeTime(value: unknown, fallback: string) {
  const text = String(value || "").trim();
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(text) ? text : fallback;
}

function sanitizeInterval(value: unknown): 15 | 30 {
  return Number(value) === 30 ? 30 : 15;
}

export function normalizeSettings(input: Partial<BusinessSettings> | null | undefined): BusinessSettings {
  const merged: BusinessSettings = {
    ...DEFAULT_SETTINGS,
    ...(input || {}),
    slotIntervalMin: sanitizeInterval(input?.slotIntervalMin),
    minAdvanceMin: Math.max(0, Number(input?.minAdvanceMin ?? DEFAULT_SETTINGS.minAdvanceMin) || DEFAULT_SETTINGS.minAdvanceMin),
    closedWeekdays: sanitizeWeekdays(input?.closedWeekdays),
    holidays: uniqueIsoDates(input?.holidays || []),
    morningEnabled: Boolean(input?.morningEnabled ?? DEFAULT_SETTINGS.morningEnabled),
    morningOpen: sanitizeTime(input?.morningOpen, DEFAULT_SETTINGS.morningOpen),
    morningClose: sanitizeTime(input?.morningClose, DEFAULT_SETTINGS.morningClose),
    afternoonEnabled: Boolean(input?.afternoonEnabled ?? DEFAULT_SETTINGS.afternoonEnabled),
    afternoonOpen: sanitizeTime(input?.afternoonOpen, DEFAULT_SETTINGS.afternoonOpen),
    afternoonClose: sanitizeTime(input?.afternoonClose, DEFAULT_SETTINGS.afternoonClose),
  };

  return merged;
}

export async function readBusinessSettings(): Promise<BusinessSettings> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf8");
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveBusinessSettings(input: Partial<BusinessSettings>) {
  const normalized = normalizeSettings(input);
  await fs.mkdir(SETTINGS_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}

export function isClosedDate(dateStr: string, settings: BusinessSettings) {
  const date = DateTime.fromISO(dateStr, { zone: TIME_ZONE });
  if (!date.isValid) return true;
  return settings.closedWeekdays.includes(date.weekday) || settings.holidays.includes(dateStr);
}

export function toDateTime(dateStr: string, timeStr: string) {
  return DateTime.fromISO(`${dateStr}T${timeStr}`, { zone: TIME_ZONE });
}

export function getDailyWindows(dateStr: string, settings: BusinessSettings) {
  const windows: { key: string; start: string; end: string }[] = [];

  if (settings.morningEnabled) {
    windows.push({ key: "morning", start: settings.morningOpen, end: settings.morningClose });
  }

  if (settings.afternoonEnabled) {
    windows.push({ key: "afternoon", start: settings.afternoonOpen, end: settings.afternoonClose });
  }

  return windows.filter((item) => {
    const start = toDateTime(dateStr, item.start);
    const end = toDateTime(dateStr, item.end);
    return start.isValid && end.isValid && end.toMillis() > start.toMillis();
  });
}

export function generateCandidateSlots(dateStr: string, settings: BusinessSettings) {
  const slots: string[] = [];

  for (const window of getDailyWindows(dateStr, settings)) {
    let current = toDateTime(dateStr, window.start);
    const end = toDateTime(dateStr, window.end);

    while (current < end) {
      slots.push(current.toFormat("HH:mm"));
      current = current.plus({ minutes: settings.slotIntervalMin });
    }
  }

  return slots;
}

export function fitsInsideWorkingWindows(
  dateStr: string,
  startTime: string,
  durationMin: number,
  settings: BusinessSettings
) {
  const start = toDateTime(dateStr, startTime);
  const end = start.plus({ minutes: durationMin });

  if (!start.isValid || !end.isValid) return false;

  return getDailyWindows(dateStr, settings).some((window) => {
    const windowStart = toDateTime(dateStr, window.start);
    const windowEnd = toDateTime(dateStr, window.end);
    return start.toMillis() >= windowStart.toMillis() && end.toMillis() <= windowEnd.toMillis();
  });
}

export function isAtLeastMinutesAhead(startISO: string, minutes: number) {
  const start = DateTime.fromISO(startISO, { zone: TIME_ZONE });
  const now = DateTime.now().setZone(TIME_ZONE);
  return start.toMillis() >= now.plus({ minutes }).toMillis();
}
