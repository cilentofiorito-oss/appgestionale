import { DateTime } from "luxon";
import {
  TIME_ZONE,
  fitsInsideWorkingWindows,
  isClosedDate,
  readBusinessSettings,
} from "@/lib/business-settings";
import { createBooking, listBookings, listBookingsForDate, markBookingCancelled } from "@/lib/bookings";
import { getBusyIntervals } from "@/lib/googleCalendar";
import { getServiceById } from "@/lib/services";

export { TIME_ZONE, listBookings };

function overlaps(startA: DateTime, endA: DateTime, startB: DateTime, endB: DateTime) {
  return startA.toMillis() < endB.toMillis() && endA.toMillis() > startB.toMillis();
}

export async function createAdminBooking(input: {
  name: string;
  phone: string;
  date: string;
  time: string;
  serviceId: string;
  notes?: string;
}) {
  if (!input.name || !input.phone || !input.date || !input.time || !input.serviceId) {
    throw new Error("Compila nome, telefono, data, orario e servizio");
  }

  const normalizedServiceId = String(input.serviceId).trim().toLowerCase();
  const service = await getServiceById(normalizedServiceId);

  if (!service || !service.active) {
    throw new Error(`Servizio non valido: ${input.serviceId}`);
  }

  const settings = await readBusinessSettings();

  if (isClosedDate(input.date, settings)) {
    throw new Error("Il salone è chiuso nella data selezionata");
  }

  const start = DateTime.fromISO(`${input.date}T${input.time}`, { zone: TIME_ZONE });
  const end = start.plus({ minutes: service.durationMin });

  if (!start.isValid || !end.isValid) {
    throw new Error("Data o orario non validi");
  }

  if (!fitsInsideWorkingWindows(input.date, input.time, service.durationMin, settings)) {
    throw new Error("L'orario scelto è fuori dagli orari di apertura configurati");
  }

  const dayBookings = await listBookingsForDate(input.date);
  const hasDbOverlap = dayBookings.some((booking) => {
    const bookingStart = DateTime.fromISO(booking.startISO, { zone: TIME_ZONE });
    const bookingEnd = DateTime.fromISO(booking.endISO, { zone: TIME_ZONE });
    return overlaps(start, end, bookingStart, bookingEnd);
  });

  if (hasDbOverlap) {
    throw new Error("Questo orario non è più disponibile");
  }

  try {
    const busyIntervals = await getBusyIntervals(start.toISO()!, end.toISO()!);
    const hasGoogleOverlap = busyIntervals.some((item) =>
      overlaps(
        start,
        end,
        DateTime.fromMillis(item.startMs, { zone: TIME_ZONE }),
        DateTime.fromMillis(item.endMs, { zone: TIME_ZONE })
      )
    );

    if (hasGoogleOverlap) {
      throw new Error("Questo orario non è più disponibile");
    }
  } catch (error: any) {
    if (error instanceof Error && /non è più disponibile/i.test(error.message)) {
      throw error;
    }
    console.error("Google overlap check error in createAdminBooking:", error);
  }

  return await createBooking({
    name: input.name,
    phone: input.phone,
    date: input.date,
    time: input.time,
    serviceId: normalizedServiceId,
    notes: input.notes,
  });
}

export async function deleteBooking(eventId: string) {
  return await markBookingCancelled(eventId);
}
