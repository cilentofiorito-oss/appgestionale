"use client";

import { useEffect, useMemo, useState } from "react";

type Booking = {
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

type BusinessSettings = {
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

type Service = { id: string; name: string; durationMin: number; price: number; active: boolean };

type DashboardResponse = { ok: boolean; range: "day" | "week" | "month"; date: string; total: number; bookings: Booking[] };

const DEFAULT_SETTINGS: BusinessSettings = {
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

const WEEKDAYS = [
  { value: 1, label: "Lunedì" },
  { value: 2, label: "Martedì" },
  { value: 3, label: "Mercoledì" },
  { value: 4, label: "Giovedì" },
  { value: 5, label: "Venerdì" },
  { value: 6, label: "Sabato" },
  { value: 7, label: "Domenica" },
];

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

function emptyService(): Service {
  return { id: "", name: "", durationMin: 30, price: 0, active: true };
}

export default function GestionalePage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [tab, setTab] = useState<"dashboard" | "clienti" | "storico" | "servizi" | "impostazioni">("dashboard");
  const [date, setDate] = useState(todayISO());
  const [range, setRange] = useState<"day" | "week" | "month">("day");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [deletingId, setDeletingId] = useState("");

  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [newHoliday, setNewHoliday] = useState("");

  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesMessage, setServicesMessage] = useState("");
  const [serviceForm, setServiceForm] = useState<Service>(emptyService());
  const [savingService, setSavingService] = useState(false);
  const [deletingServiceId, setDeletingServiceId] = useState("");

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    loadDashboard();
  }, [authenticated, date, range]);

  useEffect(() => {
    if (!authenticated) return;
    loadSettings();
    loadServices();
  }, [authenticated]);

  async function checkAuth() {
    try {
      const res = await fetch("/api/admin/me", { cache: "no-store" });
      const data = await safeJson<{ ok: boolean; authenticated: boolean }>(res);
      setAuthenticated(Boolean(data.authenticated));
    } catch {
      setAuthenticated(false);
    }
  }

  async function login() {
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      await safeJson(res);
      setAuthenticated(true);
    } catch (e: any) {
      setLoginError(e?.message || "Errore login");
    } finally {
      setLoginLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
  }

  async function loadDashboard() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/bookings?date=${date}&range=${range}`, { cache: "no-store" });
      const data = await safeJson<DashboardResponse>(res);
      setBookings(data.bookings || []);
    } catch (e: any) {
      setBookings([]);
      setMessage(e?.message || "Errore caricamento appuntamenti");
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    setSettingsLoading(true);
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      const data = await safeJson<{ ok: boolean; settings: BusinessSettings }>(res);
      setSettings(data.settings || DEFAULT_SETTINGS);
    } catch (e: any) {
      setSettingsMessage(e?.message || "Errore caricamento impostazioni");
    } finally {
      setSettingsLoading(false);
    }
  }

  async function loadServices() {
    setServicesLoading(true);
    try {
      const res = await fetch("/api/admin/services", { cache: "no-store" });
      const data = await safeJson<{ ok: boolean; services: Service[] }>(res);
      setServices(data.services || []);
    } catch (e: any) {
      setServicesMessage(e?.message || "Errore caricamento servizi");
    } finally {
      setServicesLoading(false);
    }
  }

  async function saveSettings() {
    setSavingSettings(true);
    setSettingsMessage("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await safeJson<{ ok: boolean; settings: BusinessSettings }>(res);
      setSettings(data.settings);
      setSettingsMessage("Impostazioni salvate.");
    } catch (e: any) {
      setSettingsMessage(e?.message || "Errore salvataggio impostazioni");
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveService() {
    setSavingService(true);
    setServicesMessage("");
    try {
      const payload = { ...serviceForm, id: serviceForm.id || undefined };
      const res = await fetch("/api/admin/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await safeJson<{ ok: boolean; services: Service[] }>(res);
      setServices(data.services || []);
      setServiceForm(emptyService());
      setServicesMessage("Servizio salvato con successo.");
    } catch (e: any) {
      setServicesMessage(e?.message || "Errore salvataggio servizio");
    } finally {
      setSavingService(false);
    }
  }

  async function removeService(id: string) {
    const ok = window.confirm("Vuoi davvero eliminare questo servizio?");
    if (!ok) return;
    setDeletingServiceId(id);
    try {
      const res = await fetch(`/api/admin/services?id=${id}`, { method: "DELETE" });
      const data = await safeJson<{ ok: boolean; services: Service[] }>(res);
      setServices(data.services || []);
      if (serviceForm.id === id) setServiceForm(emptyService());
    } catch (e: any) {
      setServicesMessage(e?.message || "Errore eliminazione servizio");
    } finally {
      setDeletingServiceId("");
    }
  }

  async function removeBooking(id: string) {
    const ok = window.confirm("Vuoi eliminare questo appuntamento dal gestionale e da Google Calendar?");
    if (!ok) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, { method: "DELETE" });
      await safeJson(res);
      setBookings((prev) => prev.filter((item) => item.id !== id));
    } catch (e: any) {
      setMessage(e?.message || "Errore eliminazione appuntamento");
    } finally {
      setDeletingId("");
    }
  }

  function toggleClosedWeekday(day: number) {
    setSettings((prev) => ({
      ...prev,
      closedWeekdays: prev.closedWeekdays.includes(day)
        ? prev.closedWeekdays.filter((d) => d !== day)
        : [...prev.closedWeekdays, day].sort((a, b) => a - b),
    }));
  }

  function addHoliday() {
    if (!newHoliday) return;
    setSettings((prev) => ({ ...prev, holidays: Array.from(new Set([...prev.holidays, newHoliday])).sort() }));
    setNewHoliday("");
  }

  const stats = useMemo(() => {
    const totalRevenue = bookings.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    const withPhone = bookings.filter((b) => b.phone).length;
    const uniqueClients = new Set(bookings.map((b) => `${b.customerName}|${b.phone}`)).size;
    return { totalAppointments: bookings.length, totalRevenue, withPhone, uniqueClients };
  }, [bookings]);

  const allBookingsSorted = useMemo(
    () => [...bookings].sort((a, b) => new Date(b.startISO).getTime() - new Date(a.startISO).getTime()),
    [bookings]
  );

  const customers = useMemo(() => {
    const map = new Map<string, { customerName: string; phone: string; totalBookings: number; totalSpent: number; lastDate: string; whatsappUrl: string }>();
    for (const booking of allBookingsSorted) {
      const key = `${booking.customerName}|${booking.phone}`;
      const prev = map.get(key) || {
        customerName: booking.customerName,
        phone: booking.phone,
        totalBookings: 0,
        totalSpent: 0,
        lastDate: booking.dateLabel,
        whatsappUrl: booking.whatsappUrl,
      };
      prev.totalBookings += 1;
      prev.totalSpent += Number(booking.price) || 0;
      prev.lastDate = prev.lastDate || booking.dateLabel;
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.totalBookings - a.totalBookings);
  }, [allBookingsSorted]);

  if (authenticated === null) {
    return <main className="container wideContainer"><div className="card"><div className="badge info">Caricamento gestionale...</div></div></main>;
  }

  if (!authenticated) {
    return (
      <main className="container" style={{ maxWidth: 460 }}>
        <header className="hero">
          <div className="brand">
            <div className="title">Accesso admin</div>
            <p className="subtitle">Credenziali impostate: name admin · password admin</p>
          </div>
        </header>
        <section className="card">
          <div className="grid">
            {loginError && <div className="badge error">{loginError}</div>}
            <div>
              <label>Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn" onClick={login} disabled={loginLoading}>{loginLoading ? "Accesso..." : "Entra nel gestionale"}</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="container wideContainer">
      <header className="hero leftHero" style={{ marginBottom: 18 }}>
        <div className="brand leftBrand" style={{ width: "100%" }}>
          <div className="title">Gestionale ultima generazione</div>
          <p className="subtitle">Appuntamenti, clienti, storico, servizi, prezzi e impostazioni avanzate.</p>
        </div>
      </header>

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="tabRow" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="tabRow">
            {[
              ["dashboard", "Dashboard"],
              ["clienti", "Clienti"],
              ["storico", "Storico"],
              ["servizi", "Servizi & Prezzi"],
              ["impostazioni", "Impostazioni"],
            ].map(([value, label]) => (
              <button key={value} className={`tabBtn ${tab === value ? "activeTab" : ""}`} onClick={() => setTab(value as any)}>{label}</button>
            ))}
          </div>
          <button className="tabBtn secondaryBtn" onClick={logout}>Esci</button>
        </div>
      </section>

      {tab === "dashboard" && (
        <>
          <section className="card" style={{ marginBottom: 18 }}>
            <div className="gridTwoCols">
              <div>
                <label>Data base</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <label>Vista</label>
                <select value={range} onChange={(e) => setRange(e.target.value as any)}>
                  <option value="day">Giorno</option>
                  <option value="week">Settimana</option>
                  <option value="month">Mese</option>
                </select>
              </div>
            </div>
          </section>

          <section className="statsRow" style={{ marginBottom: 18 }}>
            <div className="statBox"><strong>{stats.totalAppointments}</strong><span>Appuntamenti</span></div>
            <div className="statBox"><strong>€{stats.totalRevenue}</strong><span>Incasso stimato</span></div>
            <div className="statBox"><strong>{stats.uniqueClients}</strong><span>Clienti unici</span></div>
            <div className="statBox"><strong>{stats.withPhone}</strong><span>Con telefono</span></div>
          </section>

          <section className="card">
            <div className="grid">
              {message && <div className="badge error">{message}</div>}
              {loading ? (
                <div className="badge info">Caricamento appuntamenti...</div>
              ) : bookings.length === 0 ? (
                <div className="badge info">Nessun appuntamento trovato nella vista selezionata.</div>
              ) : (
                <div className="bookingList">
                  {bookings.map((item) => (
                    <div key={item.id} className="bookingCard">
                      <div className="bookingTop">
                        <div>
                          <h3>{item.customerName}</h3>
                          <p className="muted">{item.serviceName} · €{item.price}</p>
                        </div>
                        <div className="bookingTime">
                          <strong>{item.startLabel} - {item.endLabel}</strong>
                          <span className="muted">{item.dateLabel}</span>
                        </div>
                      </div>
                      <div className="bookingMeta">
                        <div><strong>Telefono:</strong> {item.phone || "—"}</div>
                        <div><strong>Note:</strong> {item.notes || "—"}</div>
                      </div>
                      <div className="bookingActions">
                        {item.whatsappUrl && <a className="tabBtn secondaryBtn" href={item.whatsappUrl} target="_blank">WhatsApp</a>}
                        <button className="tabBtn dangerBtn" onClick={() => removeBooking(item.id)} disabled={deletingId === item.id}>{deletingId === item.id ? "Elimino..." : "Elimina"}</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {tab === "clienti" && (
        <section className="card">
          <div className="grid">
            <div className="sectionTitle">Rubrica clienti</div>
            {customers.length === 0 ? <div className="badge info">Nessun cliente disponibile.</div> : customers.map((c, i) => (
              <div key={`${c.phone}-${i}`} className="holidayItem">
                <div>
                  <strong>{c.customerName}</strong>
                  <div className="muted">{c.phone || "Telefono non disponibile"}</div>
                  <div className="muted">Prenotazioni: {c.totalBookings} · Speso: €{c.totalSpent}</div>
                </div>
                <div className="bookingActions">
                  {c.whatsappUrl && <a className="tabBtn secondaryBtn" href={c.whatsappUrl} target="_blank">WhatsApp</a>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "storico" && (
        <section className="card">
          <div className="grid">
            <div className="sectionTitle">Storico appuntamenti</div>
            {allBookingsSorted.length === 0 ? <div className="badge info">Nessuno storico disponibile nella vista selezionata.</div> : allBookingsSorted.map((item) => (
              <div key={item.id} className="holidayItem">
                <div>
                  <strong>{item.customerName}</strong>
                  <div className="muted">{item.dateLabel} · {item.startLabel} · {item.serviceName}</div>
                </div>
                <div><strong>€{item.price}</strong></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "servizi" && (
        <section className="card">
          <div className="grid">
            <div className="sectionTitle">Gestione servizi e prezzi</div>
            {servicesMessage && <div className={`badge ${servicesMessage.includes("successo") ? "ok" : "error"}`}>{servicesMessage}</div>}
            <div className="gridTwoCols">
              <div>
                <label>ID servizio (facoltativo)</label>
                <input value={serviceForm.id} onChange={(e) => setServiceForm({ ...serviceForm, id: e.target.value })} placeholder="es. barba_taglio" />
              </div>
              <div>
                <label>Nome servizio</label>
                <input value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} placeholder="es. Taglio + Barba" />
              </div>
              <div>
                <label>Durata (min)</label>
                <input type="number" value={serviceForm.durationMin} onChange={(e) => setServiceForm({ ...serviceForm, durationMin: Number(e.target.value) })} />
              </div>
              <div>
                <label>Prezzo (€)</label>
                <input type="number" value={serviceForm.price} onChange={(e) => setServiceForm({ ...serviceForm, price: Number(e.target.value) })} />
              </div>
              <label className="switchRow fullRow"><input type="checkbox" checked={serviceForm.active} onChange={(e) => setServiceForm({ ...serviceForm, active: e.target.checked })} /> Servizio attivo nell'app prenotazioni</label>
            </div>
            <div className="bookingActions">
              <button className="btn" onClick={saveService} disabled={savingService}>{savingService ? "Salvo..." : "Salva servizio"}</button>
              <button className="tabBtn secondaryBtn" onClick={() => setServiceForm(emptyService())}>Nuovo servizio</button>
            </div>

            <div className="sectionTitle">Elenco servizi</div>
            {servicesLoading ? <div className="badge info">Caricamento servizi...</div> : services.map((service) => (
              <div key={service.id} className="holidayItem">
                <div>
                  <strong>{service.name}</strong>
                  <div className="muted">ID: {service.id}</div>
                  <div className="muted">{service.durationMin} min · €{service.price} · {service.active ? "Attivo" : "Disattivato"}</div>
                </div>
                <div className="bookingActions">
                  <button className="tabBtn secondaryBtn" onClick={() => setServiceForm(service)}>Modifica</button>
                  <button className="tabBtn dangerBtn" onClick={() => removeService(service.id)} disabled={deletingServiceId === service.id}>{deletingServiceId === service.id ? "Elimino..." : "Rimuovi"}</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "impostazioni" && (
        <section className="card">
          <div className="grid">
            <div className="sectionTitle">Impostazioni operative</div>
            {settingsMessage && <div className={`badge ${settingsMessage.includes("salvate") ? "ok" : "error"}`}>{settingsMessage}</div>}
            {settingsLoading ? <div className="badge info">Caricamento impostazioni...</div> : (
              <>
                <div className="gridTwoCols">
                  <div>
                    <label>Intervallo slot</label>
                    <select value={settings.slotIntervalMin} onChange={(e) => setSettings({ ...settings, slotIntervalMin: Number(e.target.value) as 15 | 30 })}>
                      <option value={15}>15 minuti</option>
                      <option value={30}>30 minuti</option>
                    </select>
                  </div>
                  <div>
                    <label>Anticipo minimo prenotazione</label>
                    <input type="number" value={settings.minAdvanceMin} onChange={(e) => setSettings({ ...settings, minAdvanceMin: Number(e.target.value) })} />
                  </div>
                </div>

                <div className="sectionTitle">Giorni di chiusura</div>
                <div className="checkboxGrid">
                  {WEEKDAYS.map((day) => (
                    <label key={day.value} className="checkCard">
                      <input type="checkbox" checked={settings.closedWeekdays.includes(day.value)} onChange={() => toggleClosedWeekday(day.value)} /> {day.label}
                    </label>
                  ))}
                </div>

                <div className="sectionTitle">Orari mattina</div>
                <label className="switchRow"><input type="checkbox" checked={settings.morningEnabled} onChange={(e) => setSettings({ ...settings, morningEnabled: e.target.checked })} /> Attiva fascia mattina</label>
                <div className="gridTwoCols">
                  <div><label>Apertura mattina</label><input type="time" value={settings.morningOpen} onChange={(e) => setSettings({ ...settings, morningOpen: e.target.value })} /></div>
                  <div><label>Chiusura mattina</label><input type="time" value={settings.morningClose} onChange={(e) => setSettings({ ...settings, morningClose: e.target.value })} /></div>
                </div>

                <div className="sectionTitle">Orari pomeriggio</div>
                <label className="switchRow"><input type="checkbox" checked={settings.afternoonEnabled} onChange={(e) => setSettings({ ...settings, afternoonEnabled: e.target.checked })} /> Attiva fascia pomeriggio</label>
                <div className="gridTwoCols">
                  <div><label>Apertura pomeriggio</label><input type="time" value={settings.afternoonOpen} onChange={(e) => setSettings({ ...settings, afternoonOpen: e.target.value })} /></div>
                  <div><label>Chiusura pomeriggio</label><input type="time" value={settings.afternoonClose} onChange={(e) => setSettings({ ...settings, afternoonClose: e.target.value })} /></div>
                </div>

                <div className="sectionTitle">Ferie / chiusure straordinarie</div>
                <div className="holidayRow">
                  <div><label>Nuova data di chiusura</label><input type="date" value={newHoliday} onChange={(e) => setNewHoliday(e.target.value)} /></div>
                  <button className="btn" onClick={addHoliday}>Aggiungi</button>
                </div>
                <div className="holidayList">
                  {settings.holidays.length === 0 ? <div className="badge info">Nessuna chiusura straordinaria.</div> : settings.holidays.map((holiday) => (
                    <div key={holiday} className="holidayItem">
                      <strong>{holiday}</strong>
                      <button className="miniDangerBtn" onClick={() => setSettings({ ...settings, holidays: settings.holidays.filter((d) => d !== holiday) })}>Rimuovi</button>
                    </div>
                  ))}
                </div>

                <button className="btn" onClick={saveSettings} disabled={savingSettings}>{savingSettings ? "Salvataggio..." : "Salva impostazioni"}</button>
              </>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
