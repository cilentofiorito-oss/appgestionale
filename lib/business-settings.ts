import { DateTime } from "luxon";
import { supabaseSelect, supabaseUpsert } from "@/lib/supabase-rest";

export const TIME_ZONE = "Europe/Rome";
const SETTINGS_ROW_ID = "default";

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

type SettingsRow = {
  id: string;
  slot_interval_min: number;
  min_advance_min: number;
  closed_weekdays: unknown;
  holidays: unknown;
  morning_enabled: boolean;
  morning_open: string;
  morning_close: string;
  afternoon_enabled: boolean;
  afternoon_open: string;
  afternoon_close: string;
};

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
  return {
    ...DEFAULT_SETTINGS,
    ...(input || {}),
    slotIntervalMin: sanitizeInterval(input?.slotIntervalMin),
    minAdvanceMin: Math.max(0, Number(input?.minAdvanceMin ?? DEFAULT_SETTINGS.minAdvanceMin) || DEFAULT_SETTINGS.minAdvanceMin),
    closedWeekdays: sanitizeWeekdays(input?.closedWeekdays),
    holidays: uniqueIsoDates((input?.holidays as string[]) || []),
    morningEnabled: Boolean(input?.morningEnabled ?? DEFAULT_SETTINGS.morningEnabled),
    morningOpen: sanitizeTime(input?.morningOpen, DEFAULT_SETTINGS.morningOpen),
    morningClose: sanitizeTime(input?.morningClose, DEFAULT_SETTINGS.morningClose),
    afternoonEnabled: Boolean(input?.afternoonEnabled ?? DEFAULT_SETTINGS.afternoonEnabled),
    afternoonOpen: sanitizeTime(input?.afternoonOpen, DEFAULT_SETTINGS.afternoonOpen),
    afternoonClose: sanitizeTime(input?.afternoonClose, DEFAULT_SETTINGS.afternoonClose),
  };
}

function rowToSettings(row: SettingsRow | null | undefined): BusinessSettings {
  if (!row) return DEFAULT_SETTINGS;
  return normalizeSettings({
    slotIntervalMin: sanitizeInterval(row.slot_interval_min),
    minAdvanceMin: row.min_advance_min,
    closedWeekdays: sanitizeWeekdays(row.closed_weekdays),
    holidays: uniqueIsoDates(Array.isArray(row.holidays) ? (row.holidays as string[]) : []),
    morningEnabled: Boolean(row.morning_enabled),
    morningOpen: row.morning_open,
    morningClose: row.morning_close,
    afternoonEnabled: Boolean(row.afternoon_enabled),
    afternoonOpen: row.afternoon_open,
    afternoonClose: row.afternoon_close,
  });
}

function settingsToRow(input: BusinessSettings): SettingsRow {
  return {
    id: SETTINGS_ROW_ID,
    slot_interval_min: input.slotIntervalMin,
    min_advance_min: input.minAdvanceMin,
    closed_weekdays: input.closedWeekdays,
    holidays: input.holidays,
    morning_enabled: input.morningEnabled,
    morning_open: input.morningOpen,
    morning_close: input.morningClose,
    afternoon_enabled: input.afternoonEnabled,
    afternoon_open: input.afternoonOpen,
    afternoon_close: input.afternoonClose,
  };
}

export async function readBusinessSettings(): Promise<BusinessSettings> {
  try {
    const rows = await supabaseSelect<SettingsRow[]>("business_settings", {
      select: "id,slot_interval_min,min_advance_min,closed_weekdays,holidays,morning_enabled,morning_open,morning_close,afternoon_enabled,afternoon_open,afternoon_close",
      id: `eq.${SETTINGS_ROW_ID}`,
      limit: 1,
    });
    return rowToSettings(rows?.[0]);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveBusinessSettings(input: Partial<BusinessSettings>) {
  const normalized = normalizeSettings(input);
  const rows = await supabaseUpsert<SettingsRow[]>("business_settings", settingsToRow(normalized), "id");
  return rowToSettings(rows?.[0]);
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
