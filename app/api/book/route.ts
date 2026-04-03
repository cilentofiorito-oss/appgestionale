export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { DateTime } from "luxon";
import { getServiceById } from "@/lib/services";
import {
  fitsInsideWorkingWindows,
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, phone, date, time, serviceId, notes } = body ?? {};

    if (!name || !phone || !date || !time || !serviceId) {
      return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
    }

    const normalizedServiceId = String(serviceId).trim().toLowerCase();
    const service = await getServiceById(normalizedServiceId);

    if (!service || !service.active) {
      return NextResponse.json({ error: `Servizio non valido: ${serviceId}` }, { status: 400 });
    }

    const settings = await readBusinessSettings();

    if (isClosedDate(date, settings)) {
      return NextResponse.json({ error: "Il salone è chiuso in questa data" }, { status: 400 });
    }

    const start = DateTime.fromISO(`${date}T${time}`, { zone: TIME_ZONE });
    const end = start.plus({ minutes: service.durationMin });

    if (!start.isValid || !end.isValid) {
      return NextResponse.json({ error: "Data o orario non validi" }, { status: 400 });
    }

    if (!isAtLeastMinutesAhead(start.toISO()!, settings.minAdvanceMin)) {
      return NextResponse.json({ error: `Puoi prenotare solo almeno ${settings.minAdvanceMin} minuti prima` }, { status: 400 });
    }

    if (!fitsInsideWorkingWindows(date, time, service.durationMin, settings)) {
      return NextResponse.json({ error: "L'orario scelto è fuori dagli orari di apertura configurati" }, { status: 400 });
    }

    const auth = getAuth();
    const calendar = google.calendar({ version: "v3", auth });

    const freebusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: start.toISO()!,
        timeMax: end.toISO()!,
        timeZone: TIME_ZONE,
        items: [{ id: CALENDAR_ID }],
      },
    });

    const busy =
      freebusy.data.calendars?.[CALENDAR_ID]?.busy?.map((b) => ({
        start: DateTime.fromISO(b.start!, { zone: TIME_ZONE }),
        end: DateTime.fromISO(b.end!, { zone: TIME_ZONE }),
      })) || [];

    const hasOverlap = busy.some((event) => overlaps(start, end, event.start, event.end));

    if (hasOverlap) {
      return NextResponse.json({ error: "Questo orario non è più disponibile" }, { status: 409 });
    }

    const cleanNotes = String(notes || "").trim();

    const event = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: `${service.name} - ${name}`,
        description:
          `Cliente: ${name}\n` +
          `Telefono: ${phone}\n` +
          `Servizio: ${service.name}\n` +
          `ServiceId: ${service.id}\n` +
          `Prezzo: €${service.price}\n` +
          `Data: ${date}\n` +
          `Ora: ${time}\n` +
          `Note: ${cleanNotes}`,
        start: {
          dateTime: start.toISO(),
          timeZone: TIME_ZONE,
        },
        end: {
          dateTime: end.toISO(),
          timeZone: TIME_ZONE,
        },
      },
    });

    return NextResponse.json({ success: true, eventId: event.data.id });
  } catch (error: any) {
    console.error("Booking error in /api/book:", {
      message: error?.message,
      stack: error?.stack,
      response: error?.response?.data,
    });

    return NextResponse.json(
      {
        error: "Errore durante la prenotazione",
        details: error?.response?.data || error?.message || "Errore sconosciuto",
      },
      { status: 500 }
    );
  }
}
