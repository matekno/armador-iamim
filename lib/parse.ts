import type { Dataset, EventDef, Polarity, Slot, Talmid } from "./types";

// ---------------------------------------------------------------- delimitado

/** Parser de CSV/TSV que respeta comillas dobles y saltos de línea internos. */
export function parseDelimited(text: string, delimiter?: string): string[][] {
  const raw = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const d = delimiter ?? sniffDelimiter(raw);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (quoted) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === d) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);

  return rows.map((r) => r.map((c) => c.trim()));
}

function sniffDelimiter(text: string): string {
  const firstLine = text.split("\n")[0] ?? "";
  const counts: Record<string, number> = {
    "\t": (firstLine.match(/\t/g) ?? []).length,
    ",": (firstLine.match(/,/g) ?? []).length,
    ";": (firstLine.match(/;/g) ?? []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// ------------------------------------------------------------ disponibilidad

const TRUTHY = new Set([
  "true", "verdadero", "si", "sí", "yes", "x", "1", "ok", "p", "puede",
  "✓", "✔", "v", "y", "disponible",
]);
const FALSY = new Set([
  "false", "falso", "no", "0", "", "-", "—", "n", "✗", "✘", "no puede",
]);

/** Respuestas escritas a mano que son un "no". Ej: "No puedo venir". */
const NEGATIVE = /^(no|nop)\b|no\s+(puedo|voy|asisto|llego|estoy|vengo)|ausente|falto|imposible/i;

export function isAvailable(value: string, polarity: Polarity = "vacio-no-puede"): boolean {
  const v = value.trim().toLowerCase();

  if (polarity === "vacio-puede") {
    // El formulario sólo junta ausencias: la marca es lo que dice "no puedo".
    if (v === "") return true;
    return TRUTHY.has(v);
  }

  if (v === "") return false;
  if (TRUTHY.has(v)) return true;
  if (FALSY.has(v) || NEGATIVE.test(v)) return false;
  // Cualquier otro texto se interpreta como "puso algo" = disponible.
  return true;
}

/**
 * Adivina cómo se llenó la planilla mirando los valores de las columnas de día:
 * si son TRUE/FALSE es la clásica; si son frases negativas sueltas entre celdas
 * vacías, es un form que sólo registra las ausencias.
 */
export function detectPolarity(values: string[]): Polarity {
  const filled = values.map((v) => v.trim()).filter((v) => v !== "");
  if (!filled.length) return "vacio-no-puede";
  const conocidos = filled.filter((v) => {
    const t = v.toLowerCase();
    return TRUTHY.has(t) || FALSY.has(t);
  }).length;
  if (conocidos / filled.length >= 0.6) return "vacio-no-puede";
  const negativos = filled.filter((v) => NEGATIVE.test(v)).length;
  return negativos / filled.length >= 0.6 ? "vacio-puede" : "vacio-no-puede";
}

// -------------------------------------------------------------------- fechas

const SHIFTS: Array<[RegExp, string, number]> = [
  [/\bma(ñ|n)ana\b|\bam\b|\bmatutin/i, "MAÑANA", 0],
  [/\bmediod(í|i)a\b/i, "MEDIODÍA", 1],
  [/\btarde\b|\bpm\b|\bvespertin/i, "TARDE", 2],
  [/\bnoche\b|\bnocturn/i, "NOCHE", 3],
];

const MONTHS: Record<string, number> = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4,
  may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8,
  sep: 9, sept: 9, septiembre: 9, set: 9, setiembre: 9, oct: 10, octubre: 10,
  nov: 11, noviembre: 11, dic: 12, diciembre: 12,
};

const WEEKDAYS = /\b(lunes|martes|mi(é|e)rcoles|jueves|viernes|s(á|a)bado|domingo)\b/i;

type ParsedHeader = {
  weekday?: string;
  day?: number;
  month?: number;
  year?: number;
  dateLabel?: string;
  shift?: string;
  shiftOrd: number;
};

export function parseHeader(label: string): ParsedHeader {
  const weekday = label.match(WEEKDAYS)?.[0];
  let shift: string | undefined;
  let shiftOrd = 1.5; // sin turno: queda en el medio del día
  for (const [re, name, ord] of SHIFTS) {
    if (re.test(label)) {
      shift = name;
      shiftOrd = ord;
      break;
    }
  }

  // 22/09, 22-09, 22.09.2025, 22/9/25
  let day: number | undefined;
  let month: number | undefined;
  let year: number | undefined;
  let dateLabel: string | undefined;

  const numeric = label.match(/(\d{1,2})\s*[/\-.]\s*(\d{1,2})(?:\s*[/\-.]\s*(\d{2,4}))?/);
  if (numeric) {
    day = Number(numeric[1]);
    month = Number(numeric[2]);
    if (numeric[3]) {
      const y = Number(numeric[3]);
      year = y < 100 ? 2000 + y : y;
    }
    dateLabel = numeric[3] ? `${numeric[1]}/${numeric[2]}/${numeric[3]}` : `${numeric[1]}/${numeric[2]}`;
  } else {
    // "22 de septiembre", "22 sep"
    const worded = label.match(/(\d{1,2})\s*(?:de\s+)?([a-záéíóúñ]{3,10})/i);
    if (worded) {
      const m = MONTHS[worded[2].toLowerCase()];
      if (m) {
        day = Number(worded[1]);
        month = m;
        dateLabel = `${worded[1]}/${String(m).padStart(2, "0")}`;
      }
    }
  }

  if (day !== undefined && (day < 1 || day > 31)) { day = undefined; month = undefined; dateLabel = undefined; }
  if (month !== undefined && (month < 1 || month > 12)) { day = undefined; month = undefined; dateLabel = undefined; }

  return { weekday, day, month, year, dateLabel, shift, shiftOrd };
}

const CUM_DAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

function absoluteDay(p: ParsedHeader, fallbackYear: number): number | undefined {
  if (p.day === undefined || p.month === undefined) return undefined;
  const y = p.year ?? fallbackYear;
  return y * 365 + CUM_DAYS[p.month - 1] + p.day;
}

// ------------------------------------------------------------------- eventos

const DEFAULT_EVENT_NAMES = ["Rosh Hashaná", "Iom Kipur", "Evento 3", "Evento 4"];

/**
 * Parte los slots en eventos buscando el salto de fechas más grande.
 * La idea del dominio: los días de un evento son consecutivos, y después hay
 * un hueco de varios días hasta el evento siguiente.
 */
export function splitIntoEvents(slots: Slot[], minGapDays = 3): EventDef[] {
  const events: EventDef[] = [];
  const withDates = slots.filter((s) => s.dayIndex !== undefined);

  if (withDates.length < 2) {
    const ev: EventDef = { id: "ev1", name: DEFAULT_EVENT_NAMES[0], tone: 0 };
    slots.forEach((s) => (s.eventId = ev.id));
    return [ev];
  }

  // Cortes: donde el salto respecto del slot anterior supera minGapDays.
  const cuts: number[] = [];
  for (let i = 1; i < slots.length; i++) {
    const a = slots[i - 1].dayIndex;
    const b = slots[i].dayIndex;
    if (a !== undefined && b !== undefined && b - a >= minGapDays) cuts.push(i);
  }

  const bounds = [0, ...cuts, slots.length];
  for (let i = 0; i < bounds.length - 1; i++) {
    const id = `ev${i + 1}`;
    events.push({ id, name: DEFAULT_EVENT_NAMES[i] ?? `Evento ${i + 1}`, tone: i });
    for (let j = bounds[i]; j < bounds[i + 1]; j++) slots[j].eventId = id;
  }
  return events;
}

// ------------------------------------------------------------------ dataset

export type ParseResult =
  | { ok: true; dataset: Dataset; warnings: string[]; info: string[] }
  | { ok: false; error: string };

/** Columnas de metadata que ponen Google Forms y compañía, y que no son días. */
const IGNORE_HEADER =
  /marca temporal|timestamp|hora de env|fecha de env|direcci(ó|o)n de correo|correo electr(ó|o)nico|e-?mail|puntuaci(ó|o)n|\bscore\b|^id$/i;

/** Encabezados que delatan la columna de nombres. */
const NAME_HEADER = /nombre|apellido|talmid|janij|janij(á|a)|participante|\bname\b/i;

/** Qué proporción de la columna son valores de sí/no reconocibles. */
function booleanRatio(values: string[]): number {
  const filled = values.filter((v) => v.trim() !== "");
  if (!filled.length) return 0;
  const known = filled.filter((v) => {
    const t = v.trim().toLowerCase();
    return TRUTHY.has(t) || FALSY.has(t) || NEGATIVE.test(t);
  });
  return known.length / filled.length;
}

/**
 * Encuentra la columna de nombres y las columnas de días.
 * Sirve tanto para un sheet armado a mano (nombres en la primera columna) como
 * para la hoja de respuestas de un Google Form (marca temporal, después el
 * nombre, y recién ahí los días).
 */
function detectColumns(header: string[], rows: string[][]) {
  const ncols = Math.max(header.length, ...rows.map((r) => r.length));
  const columnValues = (c: number) => rows.map((r) => r[c] ?? "");
  const h = (c: number) => (header[c] ?? "").trim();

  const dayCols: number[] = [];
  for (let c = 0; c < ncols; c++) {
    const label = h(c);
    if (!label || IGNORE_HEADER.test(label) || NAME_HEADER.test(label)) continue;
    const tieneFecha = parseHeader(label).day !== undefined;
    if (tieneFecha || booleanRatio(columnValues(c)) >= 0.6) dayCols.push(c);
  }

  let nameCol = -1;
  for (let c = 0; c < ncols; c++) {
    if (dayCols.includes(c)) continue;
    if (h(c) && NAME_HEADER.test(h(c))) {
      nameCol = c;
      break;
    }
  }
  if (nameCol < 0) {
    // Sin encabezado que lo diga: la primera columna con texto que no sea
    // metadata ni un día.
    for (let c = 0; c < ncols; c++) {
      if (dayCols.includes(c)) continue;
      if (h(c) && IGNORE_HEADER.test(h(c))) continue;
      if (columnValues(c).some((v) => v.trim() !== "")) {
        nameCol = c;
        break;
      }
    }
  }
  if (nameCol < 0) nameCol = 0;

  const ignoradas: string[] = [];
  for (let c = 0; c < ncols; c++) {
    if (c === nameCol || dayCols.includes(c)) continue;
    if (h(c)) ignoradas.push(h(c));
  }

  return { nameCol, dayCols, ignoradas };
}

export function buildDataset(text: string, sourceLabel: string): ParseResult {
  const rows = parseDelimited(text).filter((r) => r.some((c) => c !== ""));
  if (rows.length < 2) {
    return {
      ok: false,
      error: "El archivo no tiene suficientes filas. Esperaba una fila de encabezado con los días y una fila por talmid.",
    };
  }

  const header = rows[0];
  const body = rows.slice(1);
  const warnings: string[] = [];
  const info: string[] = [];

  const { nameCol, dayCols, ignoradas } = detectColumns(header, body);
  if (dayCols.length === 0) {
    return {
      ok: false,
      error:
        "No encontré ninguna columna de día. Cada día tiene que ser una columna con encabezado (ideal con la fecha, tipo «Martes 23/09 TARDE») y valores TRUE/FALSE.",
    };
  }

  const nombreCol = (header[nameCol] ?? "").trim();
  info.push(
    `Nombres: columna ${colLetter(nameCol)}${nombreCol ? ` («${nombreCol}»)` : ""}. Días: ${dayCols.length} columna(s) desde la ${colLetter(dayCols[0])}.`,
  );
  if (ignoradas.length) info.push(`Ignoré: ${ignoradas.map((x) => `«${x}»`).join(", ")}.`);

  const polarity = detectPolarity(body.flatMap((r) => dayCols.map((c) => r[c] ?? "")));
  info.push(
    polarity === "vacio-puede"
      ? "Lectura: la celda vacía es que SÍ puede, y la marcada («No puedo venir») es que no. Cambialo si no es así."
      : "Lectura: la celda marcada (TRUE/SÍ/X) es que sí puede, y la vacía es que no. Cambialo si no es así.",
  );

  const fallbackYear = new Date().getFullYear();
  const slots: Slot[] = dayCols.map((c, i) => {
    const label = header[c];
    const p = parseHeader(label);
    const dayIndex = absoluteDay(p, fallbackYear);
    return {
      id: `s${c}`,
      label,
      weekday: p.weekday,
      dateLabel: p.dateLabel,
      shift: p.shift,
      day: p.day,
      month: p.month,
      year: p.year,
      dayIndex,
      ord: dayIndex !== undefined ? dayIndex * 10 + p.shiftOrd : 1e9 + i,
      eventId: "ev1",
    };
  });

  const undated = slots.filter((s) => s.dayIndex === undefined);
  if (undated.length > 0) {
    warnings.push(
      `No pude leer la fecha de ${undated.length} columna(s) (${undated.map((s) => s.label).join(", ")}). Quedan en el orden del sheet; podés reasignarlas a mano.`,
    );
  }

  // Orden cronológico (los sin fecha quedan al final, en el orden original).
  slots.sort((a, b) => a.ord - b.ord);

  const events = splitIntoEvents(slots);
  if (events.length === 1) {
    warnings.push("Detecté un solo bloque de días. Si tenía que haber dos eventos, separalos a mano desde la solapa Datos.");
  }

  const talmidim: Talmid[] = [];
  const porNombre = new Map<string, Talmid>();
  const repetidos = new Set<string>();
  body.forEach((row, r) => {
    const name = (row[nameCol] ?? "").trim();
    if (!name) return;

    const avail: Record<string, boolean> = {};
    const raw: Record<string, string> = {};
    for (const s of slots) {
      const cell = row[Number(s.id.slice(1))] ?? "";
      raw[s.id] = cell;
      avail[s.id] = isAvailable(cell, polarity);
    }

    const previo = porNombre.get(name);
    if (previo) {
      // Hoja de respuestas de un formulario: la última respuesta manda.
      previo.avail = avail;
      previo.raw = raw;
      repetidos.add(name);
      return;
    }
    const talmid: Talmid = { id: `t${r + 1}`, name, avail, raw };
    porNombre.set(name, talmid);
    talmidim.push(talmid);
  });

  if (repetidos.size)
    warnings.push(`Respondieron más de una vez: ${[...repetidos].join(", ")}. Me quedo con la última respuesta de cada uno.`);

  if (talmidim.length === 0) {
    return {
      ok: false,
      error: `No encontré ningún talmid en la columna ${colLetter(nameCol)}${nombreCol ? ` («${nombreCol}»)` : ""}.`,
    };
  }

  const sinNada = talmidim.filter((t) => !Object.values(t.avail).some(Boolean));
  if (sinNada.length > 0) {
    warnings.push(`Sin ninguna disponibilidad: ${sinNada.map((t) => t.name).join(", ")}.`);
  }

  return {
    ok: true,
    warnings,
    info,
    dataset: {
      sourceLabel,
      importedAt: new Date().toISOString(),
      polarity,
      events,
      slots,
      talmidim,
    },
  };
}

/** Índice de columna a letra de planilla: 0 -> A, 26 -> AA. */
function colLetter(i: number): string {
  let out = "";
  let n = i;
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

// ------------------------------------------------------------ google sheets

/** Convierte cualquier link de Google Sheets en su URL de export CSV. */
export function sheetCsvUrl(input: string): string | null {
  const url = input.trim();
  const published = url.match(/\/spreadsheets\/d\/e\/([\w-]+)\/pub/);
  if (published) {
    const gid = url.match(/[?&]gid=(\d+)/)?.[1];
    return `https://docs.google.com/spreadsheets/d/e/${published[1]}/pub?output=csv${gid ? `&gid=${gid}` : ""}`;
  }
  const id = url.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1] ?? (/^[\w-]{20,}$/.test(url) ? url : null);
  if (!id) return null;
  const gid = url.match(/[#?&]gid=(\d+)/)?.[1];
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ""}`;
}
