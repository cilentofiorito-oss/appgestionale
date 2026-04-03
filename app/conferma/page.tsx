import Image from "next/image";
import Link from "next/link";

function formatDateIT(date: string) {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return date;
  return `${d}/${m}/${y}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function addMinutesToLocalDateTime(
  date: string,
  time: string,
  durationMin: number
) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);

  const dt = new Date(Date.UTC(year, month - 1, day, hours, minutes + durationMin, 0));

  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
    hours: dt.getUTCHours(),
    minutes: dt.getUTCMinutes(),
    seconds: dt.getUTCSeconds(),
  };
}

function toGoogleCalendarDate(date: string, time: string, durationMin = 60) {
  const [startYear, startMonth, startDay] = date.split("-").map(Number);
  const [startHours, startMinutes] = time.split(":").map(Number);

  const end = addMinutesToLocalDateTime(date, time, durationMin);

  const startStr =
    `${startYear}${pad(startMonth)}${pad(startDay)}T` +
    `${pad(startHours)}${pad(startMinutes)}00`;

  const endStr =
    `${end.year}${pad(end.month)}${pad(end.day)}T` +
    `${pad(end.hours)}${pad(end.minutes)}${pad(end.seconds)}`;

  return `${startStr}/${endStr}`;
}

function buildGoogleCalendarUrl(params: {
  service: string;
  date: string;
  time: string;
  durationMin: number;
  location?: string;
}) {
  const dates = toGoogleCalendarDate(
    params.date,
    params.time,
    params.durationMin
  );

  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", `Appuntamento - ${params.service}`);
  url.searchParams.set(
    "details",
    `Prenotazione confermata per ${params.service}`
  );
  url.searchParams.set("dates", dates);
  url.searchParams.set("ctz", "Europe/Rome");

  if (params.location) {
    url.searchParams.set("location", params.location);
  }

  return url.toString();
}

type SearchParams = {
  service?: string;
  date?: string;
  time?: string;
  name?: string;
  durationMin?: string;
};

export default function ConfermaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const service = searchParams.service || "";
  const date = searchParams.date || "";
  const time = searchParams.time || "";
  const name = searchParams.name || "";
  const durationMin = Number(searchParams.durationMin || "60");
  const location = "Ringhio BarberShop";

  const googleCalendarUrl =
    date && time && service
      ? buildGoogleCalendarUrl({
          service,
          date,
          time,
          durationMin,
          location,
        })
      : "#";

  return (
    <main className="container">
      <section className="card" style={{ maxWidth: 520, margin: "40px auto" }}>
        <div className="grid" style={{ textAlign: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 4,
            }}
          >
            <Image
              src="/logo-ringhio.png"
              alt="Logo Ringhio BarberShop"
              width={110}
              height={110}
              priority
              style={{
                width: "110px",
                height: "110px",
                objectFit: "contain",
              }}
            />
          </div>

          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
            Prenotazione confermata
          </h1>

          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.5 }}>
            {name ? (
              <>
                Grazie <b>{name}</b>, il tuo appuntamento è stato registrato.
              </>
            ) : (
              <>Il tuo appuntamento è stato registrato.</>
            )}
          </p>

          <div
            style={{
              background: "#000000",
              color: "#ffffff",
              borderRadius: 16,
              padding: 18,
              textAlign: "left",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ marginBottom: 8 }}>
              <b>Servizio:</b> {service || "-"}
            </div>
            <div style={{ marginBottom: 8 }}>
              <b>Data:</b> {date ? formatDateIT(date) : "-"}
            </div>
            <div>
              <b>Ora:</b> {time || "-"}
            </div>
          </div>

          <a
            href={googleCalendarUrl}
            target="_blank"
            rel="noreferrer"
            className="btn"
            aria-disabled={!date || !time || !service}
            style={
              !date || !time || !service
                ? { pointerEvents: "none", opacity: 0.6 }
                : undefined
            }
          >
            Aggiungi a Google Calendar
          </a>

          <Link href="/" className="btn">
            Torna alla home
          </Link>
        </div>
      </section>
    </main>
  );
}