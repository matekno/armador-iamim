import type { Dataset, Group, Plan, Slot, Talmid } from "./types";

export type Index = {
  talmidById: Map<string, Talmid>;
  slotById: Map<string, Slot>;
  eventIds: string[];
  slotsByEvent: Map<string, Slot[]>;
  groupOf: Map<string, Group>;
};

export function buildIndex(ds: Dataset, plan: Plan): Index {
  const slotsByEvent = new Map<string, Slot[]>();
  for (const ev of ds.events) slotsByEvent.set(ev.id, []);
  for (const s of ds.slots) {
    if (!slotsByEvent.has(s.eventId)) slotsByEvent.set(s.eventId, []);
    slotsByEvent.get(s.eventId)!.push(s);
  }
  const groupOf = new Map<string, Group>();
  for (const g of plan.groups) for (const m of g.memberIds) groupOf.set(m, g);
  return {
    talmidById: new Map(ds.talmidim.map((t) => [t.id, t])),
    slotById: new Map(ds.slots.map((s) => [s.id, s])),
    eventIds: ds.events.map((e) => e.id),
    slotsByEvent,
    groupOf,
  };
}

export const can = (t: Talmid | undefined, slotId: string | null | undefined) =>
  !!t && !!slotId && t.avail[slotId] === true;

/** Cuántos miembros del grupo pueden ese día. */
export function coverage(g: Group, slotId: string | null, idx: Index) {
  const total = g.memberIds.length;
  if (!slotId) return { available: 0, total, missing: g.memberIds.slice() };
  const missing = g.memberIds.filter((m) => !can(idx.talmidById.get(m), slotId));
  return { available: total - missing.length, total, missing };
}

export type Execution = {
  groupId: string;
  groupName: string;
  eventId: string;
  slotId: string | null;
  /** true si es la peulá que su propio grupo planificó. */
  own: boolean;
};

export function executionsOf(talmidId: string, plan: Plan, idx: Index): Execution[] {
  const out: Execution[] = [];
  const own = idx.groupOf.get(talmidId);
  for (const g of plan.groups) {
    for (const evId of idx.eventIds) {
      const p = g.peulot[evId];
      if (p?.performerIds.includes(talmidId)) {
        out.push({ groupId: g.id, groupName: g.name, eventId: evId, slotId: p.slotId, own: own?.id === g.id });
      }
    }
  }
  return out;
}

export type Issue = { level: "error" | "warn" | "info"; message: string };

export type TalmidReport = {
  talmid: Talmid;
  group: Group | undefined;
  executions: Execution[];
  ownExecutions: number;
  /** Ejecuta peulot de más de un evento distinto. */
  crossEvent: boolean;
  /** Da alguna peulá de un grupo que no es el suyo. */
  suplencias: number;
  issues: Issue[];
};

export type GroupReport = {
  group: Group;
  issues: Issue[];
  /** Algún día donde están TODOS los miembros: la preferencia del enunciado. */
  fullDayCount: number;
  perEvent: Array<{
    eventId: string;
    slot: Slot | undefined;
    available: number;
    total: number;
    missing: string[];
    performers: string[];
    suplentes: string[];
  }>;
};

export type Diagnosis = {
  byTalmid: TalmidReport[];
  byGroup: GroupReport[];
  global: Issue[];
  stats: {
    talmidim: number;
    agrupados: number;
    grupos: number;
    gruposCompletos: number;
    conDosPeulot: number;
    conPropiaPeula: number;
    conDiaCompleto: number;
    suplencias: number;
    errores: number;
    advertencias: number;
  };
};

export function diagnose(ds: Dataset, plan: Plan): Diagnosis {
  const idx = buildIndex(ds, plan);
  const nameOf = (id: string) => idx.talmidById.get(id)?.name ?? id;
  const eventName = (id: string) => ds.events.find((e) => e.id === id)?.name ?? id;
  const target = plan.settings.targetPerTalmid;

  const global: Issue[] = [];

  // ------------------------------------------------------------- por grupo
  const byGroup: GroupReport[] = plan.groups.map((g) => {
    const issues: Issue[] = [];
    if (g.memberIds.length < plan.settings.minSize)
      issues.push({ level: "error", message: `Tiene ${g.memberIds.length} talmid(im): el mínimo es ${plan.settings.minSize}.` });
    if (g.memberIds.length > plan.settings.maxSize)
      issues.push({ level: "error", message: `Tiene ${g.memberIds.length} talmidim: el máximo es ${plan.settings.maxSize}.` });

    let fullDayCount = 0;
    const perEvent = idx.eventIds.map((evId) => {
      const p = g.peulot[evId] ?? { slotId: null, performerIds: [] };
      const slot = p.slotId ? idx.slotById.get(p.slotId) : undefined;
      const cov = coverage(g, p.slotId, idx);
      if (p.slotId && cov.missing.length === 0) fullDayCount++;

      if (!p.slotId) {
        issues.push({ level: "error", message: `Falta elegir el día de la peulá de ${eventName(evId)}.` });
      } else {
        if (slot && slot.eventId !== evId)
          issues.push({ level: "error", message: `El día elegido para ${eventName(evId)} (${slot.label}) no pertenece a ese evento.` });
        const noPueden = p.performerIds.filter((id) => !can(idx.talmidById.get(id), p.slotId));
        if (noPueden.length)
          issues.push({ level: "error", message: `${noPueden.map(nameOf).join(", ")} figura(n) dando la peulá de ${eventName(evId)} un día que no puede(n) (${slot?.label}).` });
        if (p.performerIds.length === 0)
          issues.push({ level: "error", message: `Nadie está asignado a ejecutar la peulá de ${eventName(evId)}.` });
        else if (p.performerIds.length === 1)
          issues.push({ level: "warn", message: `La peulá de ${eventName(evId)} la da una sola persona.` });
      }

      return {
        eventId: evId,
        slot,
        available: cov.available,
        total: cov.total,
        missing: cov.missing.map(nameOf),
        performers: p.performerIds.map(nameOf),
        suplentes: p.performerIds.filter((id) => !g.memberIds.includes(id)).map(nameOf),
      };
    });

    // Regla dura: cada miembro tiene que poder al menos uno de los dos días
    // de su grupo, para poder ejecutar lo que planificó.
    const slotIds = idx.eventIds.map((e) => g.peulot[e]?.slotId).filter(Boolean) as string[];
    if (slotIds.length === idx.eventIds.length) {
      const atrapados = g.memberIds.filter((m) => !slotIds.some((s) => can(idx.talmidById.get(m), s)));
      if (atrapados.length)
        issues.push({
          level: "error",
          message: `${atrapados.map(nameOf).join(", ")} no puede(n) ninguno de los dos días del grupo, así que nunca ejecuta(n) lo que planificó/planificaron.`,
        });
    }

    if (slotIds.length === idx.eventIds.length && fullDayCount === 0)
      issues.push({ level: "warn", message: "Ningún día tiene al grupo completo (es una preferencia, no un requisito)." });

    return { group: g, issues, fullDayCount, perEvent };
  });

  // ------------------------------------------------------------ por talmid
  const byTalmid: TalmidReport[] = ds.talmidim.map((t) => {
    const issues: Issue[] = [];
    const group = idx.groupOf.get(t.id);
    const executions = executionsOf(t.id, plan, idx);
    const ownExecutions = executions.filter((e) => e.own).length;
    const events = new Set(executions.map((e) => e.eventId));
    const suplencias = executions.filter((e) => !e.own).length;

    if (!group) issues.push({ level: "error", message: "No está en ningún grupo de planificación." });

    if (executions.length === 0)
      issues.push({ level: "error", message: "No ejecuta ninguna peulá." });
    else if (executions.length < target)
      issues.push({ level: "error", message: `Ejecuta ${executions.length} peulá(s) y tendría que ejecutar ${target}.` });
    else if (executions.length > target)
      issues.push({ level: "warn", message: `Ejecuta ${executions.length} peulot (más de las ${target} esperadas).` });

    if (group && ownExecutions === 0)
      issues.push({ level: "error", message: "No ejecuta ninguna de las peulot que planificó su grupo." });

    if (executions.length >= 2 && events.size === 1) {
      // Sólo es un problema si de verdad podía dar en otro evento.
      const faltantes = idx.eventIds.filter((e) => !events.has(e));
      const evitable = faltantes.some((evId) => (idx.slotsByEvent.get(evId) ?? []).some((s) => can(t, s.id)));
      issues.push(
        evitable
          ? { level: "warn", message: `Sus ${executions.length} peulot son del mismo evento (${eventName([...events][0])}), pudiendo dar una de ${faltantes.map(eventName).join(" o ")}.` }
          : { level: "info", message: `Da sus ${executions.length} peulot en ${eventName([...events][0])} porque no puede ningún día de ${faltantes.map(eventName).join(" ni ")}.` },
      );
    }

    const porSlot = new Map<string, number>();
    for (const e of executions) if (e.slotId) porSlot.set(e.slotId, (porSlot.get(e.slotId) ?? 0) + 1);
    for (const [slotId, n] of porSlot)
      if (n > 1) issues.push({ level: "error", message: `Está en ${n} peulot el mismo día (${idx.slotById.get(slotId)?.label}).` });

    const noPuede = executions.filter((e) => e.slotId && !can(t, e.slotId));
    for (const e of noPuede)
      issues.push({ level: "error", message: `Figura dando una peulá el ${idx.slotById.get(e.slotId!)?.label} y no está disponible ese día.` });

    return { talmid: t, group, executions, ownExecutions, crossEvent: events.size > 1, suplencias, issues };
  });

  // --------------------------------------------------------------- globales
  const repetidos = new Map<string, number>();
  for (const g of plan.groups) for (const m of g.memberIds) repetidos.set(m, (repetidos.get(m) ?? 0) + 1);
  for (const [id, n] of repetidos)
    if (n > 1) global.push({ level: "error", message: `${nameOf(id)} está en ${n} grupos de planificación.` });

  const sinGrupo = ds.talmidim.filter((t) => !idx.groupOf.has(t.id));
  if (sinGrupo.length)
    global.push({ level: "warn", message: `${sinGrupo.length} talmid(im) sin grupo: ${sinGrupo.map((t) => t.name).join(", ")}.` });

  const errores =
    global.filter((i) => i.level === "error").length +
    byGroup.reduce((a, g) => a + g.issues.filter((i) => i.level === "error").length, 0) +
    byTalmid.reduce((a, t) => a + t.issues.filter((i) => i.level === "error").length, 0);
  const advertencias =
    global.filter((i) => i.level === "warn").length +
    byGroup.reduce((a, g) => a + g.issues.filter((i) => i.level === "warn").length, 0) +
    byTalmid.reduce((a, t) => a + t.issues.filter((i) => i.level === "warn").length, 0);

  return {
    byTalmid,
    byGroup,
    global,
    stats: {
      talmidim: ds.talmidim.length,
      agrupados: idx.groupOf.size,
      grupos: plan.groups.length,
      gruposCompletos: byGroup.filter((g) => g.perEvent.every((e) => e.slot)).length,
      conDosPeulot: byTalmid.filter((t) => t.executions.length >= target).length,
      conPropiaPeula: byTalmid.filter((t) => t.ownExecutions > 0).length,
      conDiaCompleto: byGroup.filter((g) => g.fullDayCount > 0).length,
      suplencias: byTalmid.reduce((a, t) => a + t.suplencias, 0),
      errores,
      advertencias,
    },
  };
}

/** Días de un evento ordenados por cuánta gente del grupo puede. */
export function rankedSlots(g: Group, eventId: string, ds: Dataset, idx: Index) {
  return (idx.slotsByEvent.get(eventId) ?? [])
    .map((s) => ({ slot: s, ...coverage(g, s.id, idx) }))
    .sort((a, b) => b.available - a.available || a.slot.ord - b.slot.ord);
}

export function makeGroupName(memberIds: string[], idx: Index) {
  const first = memberIds.map((id) => (idx.talmidById.get(id)?.name ?? "").split(" ")[0]);
  return first.join(", ");
}
