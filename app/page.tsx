"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

type Service = { id: string; name: string; durationMin: number; price: number; active: boolean };
type Settings = {
  slotIntervalMin: 15 | 30;
  morningEnabled: boolean;
  morningOpen: string;
  morningClose: string;
  afternoonEnabled: boolean;
  afternoonOpen: string;
  afternoonClose: string;
};
type SlotsResponse = { date: string; serviceId: string; slots: string[]; settings?: Settings };
type BookResponse = { bookingId?: string };

function todayISO() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function safeJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || "Errore server");
  return data as T;
}

function hoursLabel(settings?: Settings | null) {
  if (!settings) return "Caricamento orari...";
  const parts: string[] = [];
  if (settings.morningEnabled) parts.push(`Mattina ${settings.morningOpen}-${settings.morningClose}`);
  if (settings.afternoonEnabled) parts.push(`Pomeriggio ${settings.afternoonOpen}-${settings.afternoonClose}`);
  return parts.join(" · ");
}

export default function HomePage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadServices() {
      try {
        const res = await fetch("/api/public/services", { cache: "no-store" });
        const data = await safeJson<{ ok: boolean; services: Service[] }>(res);
        setServices(data.services || []);
        setServiceId((prev) => prev || data.services?.[0]?.id || "");
      } catch (e: any) {
        setMessage(e?.message || "Errore caricamento servizi");
      } finally {
        setServicesLoading(false);
      }
    }
    loadServices();
  }, []);

  const service = useMemo(() => services.find((s) => s.id === serviceId) || null, [services, serviceId]);

  useEffect(() => {
    if (!serviceId) return;
    async function loadSlots() {
      setLoadingSlots(true);
      setSelected("");
      setMessage("");

      try {
        const res = await fetch(`/api/slots?date=${date}&serviceId=${serviceId}`, { cache: "no-store" });
        const data = await safeJson<SlotsResponse>(res);
        setSlots(data.slots || []);
        setSettings(data.settings || null);
      } catch (e: any) {
        setSlots([]);
        setMessage(e?.message || "Errore caricamento slot");
      } finally {
        setLoadingSlots(false);
      }
    }

    loadSlots();
  }, [date, serviceId]);

  async function submit() {
    setMessage("");

    if (!selected) {
      setMessage("Seleziona un orario.");
      return;
    }

    if (!name.trim() || !phone.trim()) {
      setMessage("Inserisci nome e telefono.");
      return;
    }

    setBooking(true);

    try {
      await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, date, time: selected, name: name.trim(), phone: phone.trim(), notes }),
      }).then(safeJson<BookResponse>);

      const params = new URLSearchParams({
        service: service?.name || "Servizio",
        date,
        time: selected,
        name: name.trim(),
        durationMin: String(service?.durationMin || 0),
      });

      router.push(`/conferma?${params.toString()}`);
    } catch (e: any) {
      setMessage(e?.message || "Errore prenotazione");
    } finally {
      setBooking(false);
    }
  }

  return (
    <main className="container">
      <header className="hero">
        <div className="logoWrap">
          <Image src="/icons/icon-512.png" width={120} height={120} alt="Ringhio" priority />
        </div>

        <div className="brand">
          <div className="title">Ringhio BarberShop</div>
          <p className="subtitle">Prenota il tuo appuntamento in pochi secondi</p>
        </div>
      </header>

      <section className="card">
        <div className="grid">
          {message && <div className="badge error">{message}</div>}

          <div>
            <label>Servizio</label>
            {servicesLoading ? (
              <div className="badge info">Caricamento servizi...</div>
            ) : (
              <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.durationMin} min · €{s.price})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label>Data</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div>
            <label>Orari disponibili</label>
            {loadingSlots ? (
              <div className="badge info">Caricamento...</div>
            ) : slots.length === 0 ? (
              <div className="badge info">Nessuno slot disponibile</div>
            ) : (
              <div className="slots">
                {slots.map((t) => (
                  <button key={t} className={`slot ${selected === t ? "active" : ""}`} onClick={() => setSelected(t)} type="button">
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label>Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label>Telefono</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div>
            <label>Note</label>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <button className="btn" onClick={submit} disabled={booking || !service}>
            {booking ? "Prenotazione..." : "Conferma prenotazione"}
          </button>
        </div>
      </section>

      <div className="footer">
        Orari configurati: {hoursLabel(settings)} · intervallo slot {settings?.slotIntervalMin || 15} min · <a href="/gestionale">Apri gestionale</a>
      </div>
    </main>
  );
}
