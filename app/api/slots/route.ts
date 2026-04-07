export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
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
import { listBookingsForDate } from "@/lib/bookings";
import { getBusyIntervals, isGoogleCalendarConfigured } from "@/lib/googleCalendar";

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
      return NextResponse.json({ date, serviceId, slots: [], closed: true, googleOk: isGoogleCalendarConfigured(), settings });
    }

    const dayStart = DateTime.fromISO(`${date}T00:00:00`, { zone: TIME_ZONE });
    const dayEnd = DateTime.fromISO(`${date}T23:59:59`, { zone: TIME_ZONE });

    if (!dayStart.isValid || !dayEnd.isValid) {
      return NextResponse.json({ error: "Data non valida" }, { status: 400 });
    }

    const dayBookings = await listBookingsForDate(date);
    const dbBusy = dayBookings.map((booking) => ({
      start: DateTime.fromISO(booking.startISO, { zone: TIME_ZONE }),
      end: DateTime.fromISO(booking.endISO, { zone: TIME_ZONE }),
    }));

    let googleBusy: { start: DateTime; end: DateTime }[] = [];
    try {
      const externalBusy = await getBusyIntervals(dayStart.toISO()!, dayEnd.toISO()!);
      googleBusy = externalBusy.map((item) => ({
        start: DateTime.fromMillis(item.startMs, { zone: TIME_ZONE }),
        end: DateTime.fromMillis(item.endMs, { zone: TIME_ZONE }),
      }));
    } catch (error) {
      console.error("Google freebusy error in /api/slots:", error);
    }

    const busy = [...dbBusy, ...googleBusy];
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

    return NextResponse.json({ date, serviceId, slots: validSlots, googleOk: isGoogleCalendarConfigured(), settings });
  } catch (error: any) {
    console.error("Slots error in /api/slots:", error);
    return NextResponse.json(
      {
        error: "Errore nel recupero slot",
        details: error?.message || "Errore sconosciuto",
        googleOk: isGoogleCalendarConfigured(),
      },
      { status: 500 }
    );
  }
}
