import type { AppState, Dataset, Group, Plan } from "./types";
import { DEFAULT_SETTINGS, emptyPlan } from "./types";

export const STORAGE_KEY = "armador-iamim/v1";

const norm = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");

/**
 * Al reimportar el sheet los ids cambian, pero los nombres y los días no.
 * Esto conserva el armado ya hecho reenganchándolo por nombre y por etiqueta
 * de día, y avisa qué se perdió en el camino.
 */
export function remapPlan(oldDs: Dataset, newDs: Dataset, plan: Plan) {
  const notes: string[] = [];
  const talmidMap = new Map<string, string>();
  for (const oldT of oldDs.talmidim) {
    const match = newDs.talmidim.find((t) => norm(t.name) === norm(oldT.name));
    if (match) talmidMap.set(oldT.id, match.id);
  }
  const slotKey = (label: string) => norm(label);
  const slotMap = new Map<string, string>();
  for (const oldS of oldDs.slots) {
    const match =
      newDs.slots.find((s) => slotKey(s.label) === slotKey(oldS.label)) ??
      newDs.slots.find((s) => s.dateLabel && s.dateLabel === oldS.dateLabel && s.shift === oldS.shift);
    if (match) slotMap.set(oldS.id, match.id);
  }

  const groups: Group[] = [];
  for (const g of plan.groups) {
    const memberIds = g.memberIds.map((m) => talmidMap.get(m)).filter(Boolean) as string[];
    const perdidos = g.memberIds.length - memberIds.length;
    if (perdidos) notes.push(`${g.name}: ${perdidos} miembro(s) ya no está(n) en el sheet.`);
    if (!memberIds.length) continue;

    const peulot: Group["peulot"] = {};
    for (const [oldEv, p] of Object.entries(g.peulot)) {
      const newSlot = p.slotId ? slotMap.get(p.slotId) ?? null : null;
      if (p.slotId && !newSlot) notes.push(`${g.name}: el día elegido ya no existe en el sheet.`);
      // El evento se toma del slot nuevo, que es la fuente de verdad.
      const evId = newSlot ? newDs.slots.find((s) => s.id === newSlot)!.eventId : oldEv;
      peulot[evId] = {
        slotId: newSlot,
        performerIds: p.performerIds.map((m) => talmidMap.get(m)).filter(Boolean) as string[],
      };
    }
    for (const ev of newDs.events) if (!peulot[ev.id]) peulot[ev.id] = { slotId: null, performerIds: [] };
    groups.push({ ...g, memberIds, peulot });
  }
  const nuevos = newDs.talmidim.filter((t) => !groups.some((g) => g.memberIds.includes(t.id)));
  if (nuevos.length) notes.push(`Sin grupo: ${nuevos.map((t) => t.name).join(", ")}.`);

  return { plan: { ...plan, groups }, notes };
}

export function load(): AppState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.dataset) {
      parsed.dataset.polarity ??= "vacio-no-puede";
      for (const t of parsed.dataset.talmidim ?? []) t.raw ??= {};
    }
    return {
      dataset: parsed.dataset ?? null,
      plan: {
        groups: parsed.plan?.groups ?? [],
        settings: { ...DEFAULT_SETTINGS, ...(parsed.plan?.settings ?? {}) },
      },
    };
  } catch {
    return null;
  }
}

export function save(state: AppState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* cuota llena: no vale la pena romper la app por esto */
  }
}

export function download(filename: string, content: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const blankState = (): AppState => ({ dataset: null, plan: emptyPlan() });
