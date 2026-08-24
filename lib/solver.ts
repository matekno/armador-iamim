import { buildIndex, can, type Index } from "./model";
import type { Dataset, Group, Peula, Plan, Settings } from "./types";

// ------------------------------------------------------------------- random

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shuffled = <T,>(arr: T[], rnd: () => number): T[] => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ------------------------------------------------------------------ pesos

export type SolverOptions = {
  /** Tamaño ideal de grupo; el resto se reparte entre min y max. */
  preferredSize: number;
  /** Reintentos con distinta semilla. */
  restarts: number;
  /** Movimientos de búsqueda local por reintento. */
  iterations: number;
  /** Repartir las peulot entre los días en vez de amontonarlas. */
  spread: boolean;
  seed: number;
  /** Grupos que el usuario fijó a mano y no se tocan. */
  lockedGroupIds: string[];
  /** Grupos ya existentes en el plan, de donde se toman los fijados. */
  existingGroups: Group[];
};

export const DEFAULT_SOLVER: SolverOptions = {
  preferredSize: 4,
  restarts: 24,
  iterations: 1200,
  spread: true,
  seed: 1,
  lockedGroupIds: [],
  existingGroups: [],
};

const W = {
  puedeEjecutarLoPropio: 1000, // regla dura
  diaCompleto: 300, // preferencia: un día con el grupo entero
  cobertura: 6,
  llegaAlObjetivo: 220,
  faltanPeulot: 320,
  eventosDistintos: 70,
  suplenciaExtra: 8, // menos cambios es mejor
  amontonamiento: 4,
};

// ----------------------------------------------------- elección de los días

type Combo = { slotIds: Record<string, string>; score: number; covered: number; fullDays: number };

/** Prueba todas las combinaciones de días (una por evento) para un grupo. */
function bestCombo(memberIds: string[], ds: Dataset, idx: Index, load: Map<string, number>, spread: boolean): Combo | null {
  const perEvent = idx.eventIds.map((ev) => idx.slotsByEvent.get(ev) ?? []);
  if (perEvent.some((s) => s.length === 0)) return null;

  let best: Combo | null = null;
  const pick: string[] = [];

  const walk = (depth: number) => {
    if (depth === perEvent.length) {
      const covered = memberIds.filter((m) => pick.some((s) => can(idx.talmidById.get(m), s))).length;
      let fullDays = 0;
      let cobertura = 0;
      let crowd = 0;
      for (const s of pick) {
        const n = memberIds.filter((m) => can(idx.talmidById.get(m), s)).length;
        cobertura += n;
        if (n === memberIds.length) fullDays++;
        crowd += load.get(s) ?? 0;
      }
      const score =
        covered * W.puedeEjecutarLoPropio +
        fullDays * W.diaCompleto +
        cobertura * W.cobertura -
        (spread ? crowd * W.amontonamiento : 0);
      if (!best || score > best.score) {
        const slotIds: Record<string, string> = {};
        idx.eventIds.forEach((ev, i) => (slotIds[ev] = pick[i]));
        best = { slotIds, score, covered, fullDays };
      }
      return;
    }
    for (const s of perEvent[depth]) {
      pick.push(s.id);
      walk(depth + 1);
      pick.pop();
    }
  };
  walk(0);
  return best;
}

// ------------------------------------------------- ejecuciones y suplencias

/**
 * Rehace los rosters: primero cada quien ejecuta las peulot de su propio grupo
 * que puede, y después se completan los cambios/suplencias hasta llegar al
 * objetivo (por defecto, 2 peulot por talmid).
 */
export function fillExecutions(plan: Plan, ds: Dataset, opts?: { keepManual?: boolean }) {
  const idx = buildIndex(ds, plan);
  const target = plan.settings.targetPerTalmid;

  // 1. Base: los miembros del grupo que pueden ese día.
  for (const g of plan.groups) {
    for (const ev of idx.eventIds) {
      const p = g.peulot[ev] ?? (g.peulot[ev] = { slotId: null, performerIds: [] });
      const manual = opts?.keepManual
        ? p.performerIds.filter((id) => !g.memberIds.includes(id) && can(idx.talmidById.get(id), p.slotId))
        : [];
      const base = p.slotId ? g.memberIds.filter((m) => can(idx.talmidById.get(m), p.slotId)) : [];
      p.performerIds = [...new Set([...base, ...manual])];
    }
  }

  const countOf = new Map<string, number>();
  const slotsUsed = new Map<string, Set<string>>();
  const eventsOf = new Map<string, Set<string>>();
  const bump = (t: string, ev: string, slot: string | null) => {
    countOf.set(t, (countOf.get(t) ?? 0) + 1);
    if (!eventsOf.has(t)) eventsOf.set(t, new Set());
    eventsOf.get(t)!.add(ev);
    if (slot) {
      if (!slotsUsed.has(t)) slotsUsed.set(t, new Set());
      slotsUsed.get(t)!.add(slot);
    }
  };
  for (const g of plan.groups)
    for (const ev of idx.eventIds)
      for (const id of g.peulot[ev]?.performerIds ?? []) bump(id, ev, g.peulot[ev].slotId);

  // 2. Suplencias, empezando por quienes tienen menos opciones.
  const pendientes = ds.talmidim
    .filter((t) => (countOf.get(t.id) ?? 0) < target)
    .sort((a, b) => {
      const opciones = (x: typeof a) => Object.values(x.avail).filter(Boolean).length;
      return opciones(a) - opciones(b) || a.name.localeCompare(b.name);
    });

  for (const t of pendientes) {
    let guard = 0;
    while ((countOf.get(t.id) ?? 0) < target && guard++ < target + 2) {
      const own = idx.groupOf.get(t.id);
      const yaEventos = eventsOf.get(t.id) ?? new Set();
      const yaSlots = slotsUsed.get(t.id) ?? new Set();

      type Cand = { g: Group; ev: string; score: number };
      const cands: Cand[] = [];
      for (const g of plan.groups) {
        if (own && g.id === own.id) continue;
        for (const ev of idx.eventIds) {
          const p = g.peulot[ev];
          if (!p?.slotId) continue;
          if (!can(t, p.slotId)) continue;
          if (yaSlots.has(p.slotId)) continue;
          if (p.performerIds.includes(t.id)) continue;
          const suplentesActuales = p.performerIds.filter((id) => !g.memberIds.includes(id)).length;
          const faltantes = g.memberIds.length - p.performerIds.filter((id) => g.memberIds.includes(id)).length;
          const score =
            (yaEventos.has(ev) ? 0 : 400) + // ideal: una de cada evento
            faltantes * 60 + // priorizar grupos que perdieron gente
            -suplentesActuales * 40 + // repartir los cambios
            -p.performerIds.length * 5;
          cands.push({ g, ev, score });
        }
      }
      if (!cands.length) break;
      cands.sort((a, b) => b.score - a.score || a.g.id.localeCompare(b.g.id) || a.ev.localeCompare(b.ev));
      const best = cands[0];
      best.g.peulot[best.ev].performerIds.push(t.id);
      bump(t.id, best.ev, best.g.peulot[best.ev].slotId);
    }
  }
  return plan;
}

// ------------------------------------------------------------------- score

export function scorePlan(plan: Plan, ds: Dataset, opts: SolverOptions): number {
  const idx = buildIndex(ds, plan);
  const target = plan.settings.targetPerTalmid;
  let score = 0;

  const load = new Map<string, number>();
  for (const g of plan.groups) {
    const slotIds = idx.eventIds.map((ev) => g.peulot[ev]?.slotId).filter(Boolean) as string[];
    for (const s of slotIds) load.set(s, (load.get(s) ?? 0) + 1);

    for (const s of slotIds) {
      const n = g.memberIds.filter((m) => can(idx.talmidById.get(m), s)).length;
      score += n * W.cobertura;
      if (n === g.memberIds.length && g.memberIds.length > 0) score += W.diaCompleto;
    }
    for (const m of g.memberIds) {
      if (slotIds.some((s) => can(idx.talmidById.get(m), s))) score += W.puedeEjecutarLoPropio;
      else score -= W.puedeEjecutarLoPropio * 4;
    }
  }
  if (opts.spread) for (const n of load.values()) score -= Math.max(0, n - 1) * W.amontonamiento * 2;

  for (const t of ds.talmidim) {
    let n = 0;
    const evs = new Set<string>();
    let suplencias = 0;
    const own = idx.groupOf.get(t.id);
    for (const g of plan.groups)
      for (const ev of idx.eventIds)
        if (g.peulot[ev]?.performerIds.includes(t.id)) {
          n++;
          evs.add(ev);
          if (!own || g.id !== own.id) suplencias++;
        }
    if (n >= target) score += W.llegaAlObjetivo;
    else score -= (target - n) * W.faltanPeulot;
    if (evs.size > 1) score += W.eventosDistintos;
    score -= suplencias * W.suplenciaExtra;
  }
  return score;
}

// -------------------------------------------------------- armado automático

function sizePlan(n: number, s: Settings, preferred: number): number[] {
  const pref = Math.min(Math.max(preferred, s.minSize), s.maxSize);
  let groups = Math.max(1, Math.round(n / pref));
  while (groups * s.maxSize < n) groups++;
  while (groups > 1 && groups * s.minSize > n) groups--;
  const sizes = Array.from({ length: groups }, () => Math.floor(n / groups));
  let resto = n - sizes.reduce((a, b) => a + b, 0);
  for (let i = 0; resto > 0; i = (i + 1) % groups) {
    if (sizes[i] < s.maxSize) {
      sizes[i]++;
      resto--;
    }
  }
  return sizes;
}

function assignAllSlots(plan: Plan, ds: Dataset, opts: SolverOptions) {
  const idx = buildIndex(ds, plan);
  const load = new Map<string, number>();
  const orden = plan.groups
    .map((g, i) => ({ g, i, flex: g.memberIds.reduce((a, m) => a + Object.values(idx.talmidById.get(m)?.avail ?? {}).filter(Boolean).length, 0) }))
    .sort((a, b) => a.flex - b.flex);
  for (const { g } of orden) {
    if (opts.lockedGroupIds.includes(g.id)) {
      for (const ev of idx.eventIds) {
        const s = g.peulot[ev]?.slotId;
        if (s) load.set(s, (load.get(s) ?? 0) + 1);
      }
      continue;
    }
    const combo = bestCombo(g.memberIds, ds, idx, load, opts.spread);
    for (const ev of idx.eventIds) {
      const slotId = combo?.slotIds[ev] ?? null;
      g.peulot[ev] = { slotId, performerIds: [] } as Peula;
      if (slotId) load.set(slotId, (load.get(slotId) ?? 0) + 1);
    }
  }
}

function buildGreedy(ds: Dataset, settings: Settings, opts: SolverOptions, rnd: () => number, locked: Group[]): Plan {
  const tomados = new Set(locked.flatMap((g) => g.memberIds));
  const libres = ds.talmidim.filter((t) => !tomados.has(t.id));
  const plan: Plan = { groups: locked.map((g) => structuredClone(g)), settings };
  if (!libres.length) return plan;

  const idx0 = buildIndex(ds, plan);
  const sizes = sizePlan(libres.length, settings, opts.preferredSize);
  // Los más restringidos primero: son los que definen si el armado cierra.
  const pool = shuffled(libres, rnd).sort(
    (a, b) => Object.values(a.avail).filter(Boolean).length - Object.values(b.avail).filter(Boolean).length,
  );

  const usados = new Set<string>();
  const load = new Map<string, number>();
  let n = plan.groups.length;

  for (const size of sizes) {
    const seed = pool.find((t) => !usados.has(t.id));
    if (!seed) break;
    const members = [seed.id];
    usados.add(seed.id);

    while (members.length < size) {
      let best: { id: string; score: number } | null = null;
      for (const t of pool) {
        if (usados.has(t.id)) continue;
        const combo = bestCombo([...members, t.id], ds, idx0, load, opts.spread);
        const score = (combo?.score ?? -1e9) + rnd() * 30;
        if (!best || score > best.score) best = { id: t.id, score };
      }
      if (!best) break;
      members.push(best.id);
      usados.add(best.id);
    }

    const combo = bestCombo(members, ds, idx0, load, opts.spread);
    const peulot: Record<string, Peula> = {};
    for (const ev of idx0.eventIds) {
      const slotId = combo?.slotIds[ev] ?? null;
      peulot[ev] = { slotId, performerIds: [] };
      if (slotId) load.set(slotId, (load.get(slotId) ?? 0) + 1);
    }
    n++;
    plan.groups.push({ id: `g${n}`, name: `Grupo ${n}`, memberIds: members, peulot });
  }

  // Si sobró alguien (por redondeo), va al grupo donde mejor encaja.
  for (const t of pool) {
    if (usados.has(t.id)) continue;
    let best: { g: Group; score: number } | null = null;
    for (const g of plan.groups) {
      if (opts.lockedGroupIds.includes(g.id) || g.memberIds.length >= settings.maxSize) continue;
      const combo = bestCombo([...g.memberIds, t.id], ds, idx0, load, opts.spread);
      const score = combo?.score ?? -1e9;
      if (!best || score > best.score) best = { g, score };
    }
    if (best) best.g.memberIds.push(t.id);
    else plan.groups.push({ id: `g${++n}`, name: `Grupo ${n}`, memberIds: [t.id], peulot: {} });
    usados.add(t.id);
  }
  return plan;
}

function evaluate(plan: Plan, ds: Dataset, opts: SolverOptions): number {
  assignAllSlots(plan, ds, opts);
  fillExecutions(plan, ds);
  return scorePlan(plan, ds, opts);
}

export type SolveResult = { plan: Plan; score: number; restartsUsed: number };

export function solve(ds: Dataset, settings: Settings, options: Partial<SolverOptions> = {}): SolveResult {
  const opts: SolverOptions = { ...DEFAULT_SOLVER, ...options };
  const locked = opts.existingGroups.filter((g) => opts.lockedGroupIds.includes(g.id));

  let best: Plan | null = null;
  let bestScore = -Infinity;

  for (let r = 0; r < opts.restarts; r++) {
    const rnd = mulberry32(opts.seed * 7919 + r * 104729);
    let plan = buildGreedy(ds, settings, opts, rnd, locked);
    let score = evaluate(plan, ds, opts);

    // Búsqueda local: mover y permutar talmidim entre grupos.
    const movibles = () => plan.groups.filter((g) => !opts.lockedGroupIds.includes(g.id));
    for (let it = 0; it < opts.iterations; it++) {
      const gs = movibles();
      if (gs.length < 2) break;
      const a = gs[Math.floor(rnd() * gs.length)];
      const b = gs[Math.floor(rnd() * gs.length)];
      if (a === b || !a.memberIds.length) continue;

      const candidate = structuredClone(plan);
      const ca = candidate.groups.find((g) => g.id === a.id)!;
      const cb = candidate.groups.find((g) => g.id === b.id)!;
      const i = Math.floor(rnd() * ca.memberIds.length);

      if (rnd() < 0.5 && cb.memberIds.length) {
        const j = Math.floor(rnd() * cb.memberIds.length);
        [ca.memberIds[i], cb.memberIds[j]] = [cb.memberIds[j], ca.memberIds[i]];
      } else {
        if (ca.memberIds.length <= settings.minSize || cb.memberIds.length >= settings.maxSize) continue;
        cb.memberIds.push(ca.memberIds.splice(i, 1)[0]);
      }

      const s = evaluate(candidate, ds, opts);
      if (s > score) {
        plan = candidate;
        score = s;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = plan;
    }
  }

  const plan = best ?? { groups: [], settings };
  plan.groups = plan.groups.filter((g) => g.memberIds.length > 0);
  // Los nombres se rehacen al final: la búsqueda local movió gente de grupo.
  plan.groups.forEach((g, i) => {
    if (!opts.lockedGroupIds.includes(g.id)) g.name = `Grupo ${i + 1}`;
  });
  return { plan, score: bestScore, restartsUsed: opts.restarts };
}
