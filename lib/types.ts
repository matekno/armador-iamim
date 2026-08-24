// Modelo de datos del armador de Iamim Noraim.
//
// Idea central: PLANIFICAR y EJECUTAR son dos cosas distintas.
// - Un grupo (2 a 5 talmidim) PLANIFICA una peulá por evento (RH e IK).
// - Cada peulá se EJECUTA un día concreto, y quienes la dan (el "roster")
//   no son necesariamente los mismos que la planificaron: si un miembro no
//   puede ese día, se hace un cambio/suplencia.

/** Una columna del sheet: un día + turno concreto. */
export type Slot = {
  id: string;
  /** Header original, tal cual viene del sheet. Ej: "Martes 23/09 TARDE". */
  label: string;
  /** Día de la semana detectado. Ej: "Martes". */
  weekday?: string;
  /** Parte de fecha detectada. Ej: "23/09". */
  dateLabel?: string;
  /** Turno detectado, normalizado. Ej: "MAÑANA". */
  shift?: string;
  /** Día del mes / mes, si se pudieron leer del header. */
  day?: number;
  month?: number;
  year?: number;
  /** Número de día absoluto para calcular saltos entre fechas. */
  dayIndex?: number;
  /** Orden cronológico dentro del set (fecha + turno). */
  ord: number;
  eventId: string;
};

/** Un evento: el bloque de días consecutivos (Rosh Hashaná, Iom Kipur, ...). */
export type EventDef = {
  id: string;
  name: string;
  /** Índice para colorear de forma estable. */
  tone: number;
};

export type Talmid = {
  id: string;
  name: string;
  /** slotId -> puede / no puede. */
  avail: Record<string, boolean>;
  /** El texto crudo de la celda, para poder reinterpretarlo si cambia la lectura. */
  raw: Record<string, string>;
};

/**
 * Qué significa una celda vacía.
 * - "vacio-no-puede": la planilla clásica de TRUE/FALSE. Vacío = no puede.
 * - "vacio-puede": el form sólo recoge las ausencias ("No puedo venir"), así
 *   que vacío = sí puede y cualquier marca = no puede.
 */
export type Polarity = "vacio-no-puede" | "vacio-puede";

/** Lo que se importa del sheet. */
export type Dataset = {
  sourceLabel: string;
  importedAt: string;
  polarity: Polarity;
  events: EventDef[];
  slots: Slot[];
  talmidim: Talmid[];
};

/** La peulá que un grupo planificó para un evento. */
export type Peula = {
  /** Día en que se ejecuta. null = todavía sin fecha. */
  slotId: string | null;
  /** Quiénes la dan realmente (miembros presentes + suplentes de otros grupos). */
  performerIds: string[];
};

export type Group = {
  id: string;
  name: string;
  /** Quiénes la PLANIFICAN. */
  memberIds: string[];
  /** eventId -> peulá planificada para ese evento. */
  peulot: Record<string, Peula>;
};

export type Settings = {
  minSize: number;
  maxSize: number;
  /** Cuántas peulot debería dar cada talmid. */
  targetPerTalmid: number;
};

export type Plan = {
  groups: Group[];
  settings: Settings;
};

export type AppState = {
  dataset: Dataset | null;
  plan: Plan;
};

export const DEFAULT_SETTINGS: Settings = {
  minSize: 2,
  maxSize: 5,
  targetPerTalmid: 2,
};

export const emptyPlan = (): Plan => ({ groups: [], settings: { ...DEFAULT_SETTINGS } });
