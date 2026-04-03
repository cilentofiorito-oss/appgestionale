export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { DateTime } from "luxon";
import { getServiceById } from "@/lib/services";
import {
  fitsInsideWorkingWindows,
  generateCandidateSlots,
  isAtLeastMinutesAhead,
  isClosedDate,
  readBusinessSettings,
  TIME_ZONE,
} from "@/lib/business-settings";

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || process.env.CALENDAR_ID || "primary";

function getAuth() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId) throw new Error("Manca GOOGLE_CLIENT_ID");
  if (!clientSecret) throw new Error("Manca GOOGLE_CLIENT_SECRET");
  if (!redirectUri) throw new Error("Manca GOOGLE_REDIRECT_URI");
  if (!refreshToken) throw new Error("Manca GOOGLE_REFRESH_TOKEN");

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

function overlaps(startA: DateTime, endA: DateTime, startB: DateTime, endB: DateTime) {
  return startA.toMillis() < endB.toMillis() && endA.toMillis() > startB.toMillis();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const rawServiceId = searchParams.get("serviceId");

    if (!date || !rawServiceId) {
      return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
    }

    const serviceId = String(rawServiceId).trim().toLowerCase();
    const service = await getServiceById(serviceId);

    if (!service || !service.active) {
      return NextResponse.json({ error: `Servizio non valido: ${rawServiceId}` }, { status: 400 });
    }

    const settings = await readBusinessSettings();

    if (isClosedDate(date, settings)) {
      return NextResponse.json({ date, serviceId, slots: [], closed: true, googleOk: true, settings });
    }

    const dayStart = DateTime.fromISO(`${date}T00:00:00`, { zone: TIME_ZONE });
    const dayEnd = DateTime.fromISO(`${date}T23:59:59`, { zone: TIME_ZONE });

    if (!dayStart.isValid || !dayEnd.isValid) {
      return NextResponse.json({ error: "Data non valida" }, { status: 400 });
    }

    const auth = getAuth();
    const calendar = google.calendar({ version: "v3", auth });

    const freebusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: dayStart.toISO()!,
        timeMax: dayEnd.toISO()!,
        timeZone: TIME_ZONE,
        items: [{ id: CALENDAR_ID }],
      },
    });

    const busy =
      freebusy.data.calendars?.[CALENDAR_ID]?.busy?.map((b) => ({
        start: DateTime.fromISO(b.start!, { zone: TIME_ZONE }),
        end: DateTime.fromISO(b.end!, { zone: TIME_ZONE }),
      })) || [];

    const candidates = generateCandidateSlots(date, settings);

    const validSlots = candidates.filter((slot) => {
      const slotStart = DateTime.fromISO(`${date}T${slot}`, { zone: TIME_ZONE });
      const slotEnd = slotStart.plus({ minutes: service.durationMin });

      if (!slotStart.isValid || !slotEnd.isValid) return false;
      if (!isAtLeastMinutesAhead(slotStart.toISO()!, settings.minAdvanceMin)) return false;
      if (!fitsInsideWorkingWindows(date, slot, service.durationMin, settings)) return false;

      const hasOverlap = busy.some((event) => overlaps(slotStart, slotEnd, event.start, event.end));
      return !hasOverlap;
    });

    return NextResponse.json({ date, serviceId, slots: validSlots, googleOk: true, settings });
  } catch (error: any) {
    console.error("Google freebusy error in /api/slots:", {
      message: error?.message,
      stack: error?.stack,
      response: error?.response?.data,
    });

    return NextResponse.json(
      {
        error: "Errore nel recupero slot",
        details: error?.response?.data || error?.message || "Errore sconosciuto",
        googleOk: false,
      },
      { status: 500 }
    );
  }
}
