import { promises as fs } from "fs";
import path from "path";

export type ServiceItem = {
  id: string;
  name: string;
  durationMin: number;
  price: number;
  active: boolean;
};

export const DEFAULT_SERVICES: Record<string, ServiceItem> = {
  barba: { id: "barba", name: "Barba", durationMin: 15, price: 10, active: true },
  taglio: { id: "taglio", name: "Taglio", durationMin: 30, price: 20, active: true },
  barba_taglio: { id: "barba_taglio", name: "Taglio + Barba", durationMin: 45, price: 30, active: true },
};

const DATA_DIR = path.join(process.cwd(), "data");
const SERVICES_FILE = path.join(DATA_DIR, "services.json");

function slugify(text: string) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

function sanitizeService(input: Partial<ServiceItem>, fallbackId?: string): ServiceItem {
  const name = String(input.name || "").trim() || "Nuovo servizio";
  const id = slugify(String(input.id || fallbackId || name)) || `servizio_${Date.now()}`;
  const durationMin = Math.max(5, Math.min(480, Number(input.durationMin) || 30));
  const price = Math.max(0, Number(input.price) || 0);
  const active = input.active !== false;
  return { id, name, durationMin, price, active };
}

function normalizeServices(input: any): Record<string, ServiceItem> {
  if (!input || typeof input !== "object") return { ...DEFAULT_SERVICES };
  const result: Record<string, ServiceItem> = {};
  for (const [key, value] of Object.entries(input)) {
    const item = sanitizeService(value as Partial<ServiceItem>, key);
    result[item.id] = item;
  }
  return Object.keys(result).length ? result : { ...DEFAULT_SERVICES };
}

export async function readServicesMap() {
  try {
    const raw = await fs.readFile(SERVICES_FILE, "utf8");
    return normalizeServices(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SERVICES };
  }
}

export async function saveServicesMap(input: Record<string, ServiceItem>) {
  const normalized = normalizeServices(input);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SERVICES_FILE, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}

export async function readServicesList(includeInactive = false) {
  const map = await readServicesMap();
  const list = Object.values(map).sort((a, b) => a.name.localeCompare(b.name, "it"));
  return includeInactive ? list : list.filter((item) => item.active);
}

export async function getServiceById(serviceId: string) {
  const map = await readServicesMap();
  return map[String(serviceId || "").trim().toLowerCase()] || null;
}

export async function upsertService(input: Partial<ServiceItem>) {
  const map = await readServicesMap();
  const item = sanitizeService(input, input.id);
  map[item.id] = item;
  await saveServicesMap(map);
  return item;
}

export async function deleteService(serviceId: string) {
  const map = await readServicesMap();
  delete map[String(serviceId || "").trim().toLowerCase()];
  await saveServicesMap(map);
}
