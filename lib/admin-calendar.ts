import { google } from "googleapis";
import { DateTime } from "luxon";
import { getServiceById } from "@/lib/services";

export const TIME_ZONE = "Europe/Rome";
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || process.env.CALENDAR_ID || "primary";

export type BookingItem = {
  id: string;
  summary: string;
  serviceId: string;
  serviceName: string;
  customerName: string;
  phone: string;
  notes: string;
  price: number;
  startISO: string;
  endISO: string;
  startLabel: string;
  endLabel: string;
  dateLabel: string;
  whatsappUrl: string;
};

function getOAuth2Client() {
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

function getCalendar() {
  return google.calendar({ version: "v3", auth: getOAuth2Client() });
}

function firstMatch(input: string, regex: RegExp) {
  return input.match(regex)?.[1]?.trim() || "";
}

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

function toWhatsappUrl(phone: string) {
  const cleaned = normalizePhone(phone);
  if (!cleaned) return "";
  const international = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  return `https://wa.me/${international}`;
}

async function parseBooking(event: any): Promise<BookingItem> {
  const description = String(event.description || "");
  const summary = String(event.summary || "Appuntamento");
  const startISO = String(event.start?.dateTime || event.start?.date || "");
  const endISO = String(event.end?.dateTime || event.end?.date || "");

  const start = DateTime.fromISO(startISO, { zone: TIME_ZONE });
  const end = DateTime.fromISO(endISO, { zone: TIME_ZONE });

  const customerName = firstMatch(description, /Cliente:\s*(.+)/i) || summary.split("-").slice(1).join("-").trim();
  const phone = firstMatch(description, /Telefono:\s*(.+)/i);
  const serviceName = firstMatch(description, /Servizio:\s*(.+)/i) || summary.split("-")[0].trim();
  const serviceId = firstMatch(description, /ServiceId:\s*(.+)/i).toLowerCase();
  const notes = firstMatch(description, /Note:\s*([\s\S]+)/i);
  const service = serviceId ? await getServiceById(serviceId) : null;

  return {
    id: String(event.id || ""),
    summary,
    serviceId: serviceId || service?.id || "",
    serviceName: service?.name || serviceName || "Servizio",
    customerName: customerName || "Cliente",
    phone,
    notes,
    price: service?.price || 0,
    startISO,
    endISO,
    startLabel: start.isValid ? start.toFormat("HH:mm") : "",
    endLabel: end.isValid ? end.toFormat("HH:mm") : "",
    dateLabel: start.isValid ? start.setLocale("it").toFormat("cccc dd LLLL yyyy") : "",
    whatsappUrl: toWhatsappUrl(phone),
  };
}

export async function listBookings(fromISO: string, toISO: string) {
  const cal = getCalendar();
  const result = await cal.events.list({
    calendarId: CALENDAR_ID,
    timeMin: fromISO,
    timeMax: toISO,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });

  const items = result.data.items || [];
  return Promise.all(
    items
      .filter((event) => event.status !== "cancelled" && event.start?.dateTime)
      .map(parseBooking)
  );
}

export async function deleteBooking(eventId: string) {
  const cal = getCalendar();
  await cal.events.delete({
    calendarId: CALENDAR_ID,
    eventId,
  });
}
