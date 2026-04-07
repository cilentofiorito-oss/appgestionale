"use client";

import { useEffect, useMemo, useState } from "react";

type Appointment = {
  id: string;
  name: string;
  phone: string;
  service: string;
  date: string;
  time: string;
  notes?: string;
  price?: number;
};

export default function GestionalePage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [openHistoryCustomerKey, setOpenHistoryCustomerKey] = useState<string | null>(null);

  // 🔥 GRUPPO CLIENTI (PRIMA DI TUTTO)
  const customerHistoryGroups = useMemo(() => {
    const map = new Map<string, Appointment[]>();

    appointments.forEach((a) => {
      const key = `${a.name}-${a.phone}`;

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key)!.push(a);
    });

    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      name: items[0].name,
      phone: items[0].phone,
      appointments: items.sort((a, b) =>
        `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)
      ),
    }));
  }, [appointments]);

  // ✅ ORA QUESTO NON DARÀ PIÙ ERRORE
  useEffect(() => {
    if (!openHistoryCustomerKey && customerHistoryGroups.length > 0) {
      setOpenHistoryCustomerKey(customerHistoryGroups[0].key);
    }
  }, [customerHistoryGroups, openHistoryCustomerKey]);

  // MOCK fetch (sostituisci con la tua API)
  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/appointments");
      const data = await res.json();
      setAppointments(data || []);
    }
    load();
  }, []);

  return (
    <div className="p-6 text-white bg-black min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Storico Clienti</h1>

      <div className="space-y-4">
        {customerHistoryGroups.map((customer) => {
          const isOpen = openHistoryCustomerKey === customer.key;

          return (
            <div key={customer.key} className="border border-gray-700 rounded-xl">
              
              {/* HEADER CLIENTE */}
              <button
                onClick={() =>
                  setOpenHistoryCustomerKey(isOpen ? null : customer.key)
                }
                className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-900"
              >
                <div>
                  <div className="font-semibold">{customer.name}</div>
                  <div className="text-sm text-gray-400">{customer.phone}</div>
                </div>
                <div>{isOpen ? "−" : "+"}</div>
              </button>

              {/* STORICO */}
              {isOpen && (
                <div className="border-t border-gray-700">
                  {customer.appointments.map((a) => (
                    <div
                      key={a.id}
                      className="p-4 border-b border-gray-800 flex justify-between"
                    >
                      <div>
                        <div className="font-medium">{a.service}</div>
                        <div className="text-sm text-gray-400">
                          {a.date} - {a.time}
                        </div>
                        {a.notes && (
                          <div className="text-sm text-gray-500">{a.notes}</div>
                        )}
                      </div>

                      <div className="text-right">
                        {a.price ? (
                          <div className="font-bold">€ {a.price}</div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}