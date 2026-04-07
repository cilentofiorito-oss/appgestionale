import { google } from "googleapis";
import { DateTime } from "luxon";

export const TIME_ZONE = "Europe/Rome";
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || process.env.CALENDAR_ID || "primary";

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !redirectUri || !refreshToken) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

function getCalendar() {
  const auth = getOAuth2Client();
  if (!auth) return null;
  return google.calendar({ version: "v3", auth });
}

function isAlreadyDeletedGoogleError(error: any) {
  const status = error?.code || error?.response?.status || error?.status;
  const message = String(
    error?.message || error?.response?.data?.error?.message || error?.response?.data?.message || ""
  ).toLowerCase();

  return (
    status === 404 ||
    status === 410 ||
    message.includes("resource has been deleted") ||
    message.includes("not found") ||
    message.includes("deleted")
  );
}

export function isGoogleCalendarConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI &&
      process.env.GOOGLE_REFRESH_TOKEN
  );
}

export async function getBusyIntervals(
  timeMinISO: string,
  timeMaxISO: string
): Promise<{ startMs: number; endMs: number }[]> {
  const cal = getCalendar();
  if (!cal) return [];

  const resp = await cal.freebusy.query({
    requestBody: {
      timeMin: timeMinISO,
      timeMax: timeMaxISO,
      timeZone: TIME_ZONE,
      items: [{ id: CALENDAR_ID }],
    },
  });

  const busy = resp.data.calendars?.[CALENDAR_ID]?.busy || [];
  return busy
    .filter((b) => b.start && b.end)
    .map((b) => ({
      startMs: DateTime.fromISO(b.start!, { zone: TIME_ZONE }).toMillis(),
      endMs: DateTime.fromISO(b.end!, { zone: TIME_ZONE }).toMillis(),
    }));
}

export async function createBookingEvent(args: {
  summary: string;
  description?: string;
  startDateTimeLocal: string;
  endDateTimeLocal: string;
}) {
  const cal = getCalendar();
  if (!cal) return null;

  const res = await cal.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: args.summary,
      description: args.description || "",
      start: {
        dateTime: args.startDateTimeLocal,
        timeZone: TIME_ZONE,
      },
      end: {
        dateTime: args.endDateTimeLocal,
        timeZone: TIME_ZONE,
      },
    },
  });

  return res.data.id || null;
}

export async function deleteBookingEvent(eventId: string) {
  const cal = getCalendar();
  if (!cal || !eventId) {
    return { ok: true, skipped: true };
  }

  try {
    await cal.events.delete({ calendarId: CALENDAR_ID, eventId });
    return { ok: true, deleted: true };
  } catch (error: any) {
    if (isAlreadyDeletedGoogleError(error)) {
      return { ok: true, alreadyDeleted: true };
    }
    throw error;
  }
}
