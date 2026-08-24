import { buildIndex, diagnose } from "./model";
import type { Dataset, Plan } from "./types";

export type ReportKind = "grupos" | "talmidim" | "dias" | "cambios" | "csv";

export const REPORTS: Array<{ id: ReportKind; title: string; blurb: string }> = [
  { id: "grupos", title: "Por grupo", blurb: "Cada grupo con sus miembros, los días de sus dos peulot y quién las da." },
  { id: "talmidim", title: "Por talmid", blurb: "Cada talmid con su grupo y las peulot que ejecuta." },
  { id: "dias", title: "Por día", blurb: "Agenda: qué se da cada día y quiénes lo dan." },
  { id: "cambios", title: "Cambios y suplencias", blurb: "Sólo quién da una peulá que no planificó, y a quién reemplaza." },
  { id: "csv", title: "Planilla (CSV)", blurb: "Tabla plana para pegar de vuelta en el Google Sheets." },
];

export function buildReport(kind: ReportKind, ds: Dataset, plan: Plan): string {
  const idx = buildIndex(ds, plan);
  const diag = diagnose(ds, plan);
  const name = (id: string) => idx.talmidById.get(id)?.name ?? id;
  const slot = (id: string | null | undefined) => (id ? idx.slotById.get(id)?.label ?? "?" : "SIN DÍA");
  const evName = (id: string) => ds.events.find((e) => e.id === id)?.name ?? id;
  const L: string[] = [];

  if (kind === "grupos") {
    L.push("GRUPOS", "=".repeat(60), "");
    for (const g of plan.groups) {
      L.push(`${g.name}  (${g.memberIds.length} talmidim)`);
      L.push(`  Planifican: ${g.memberIds.map(name).join(", ")}`);
      for (const ev of ds.events) {
        const p = g.peulot[ev.id];
        const sup = p?.performerIds.filter((i) => !g.memberIds.includes(i)) ?? [];
        const falt = g.memberIds.filter((i) => !p?.performerIds.includes(i));
        L.push(`  ${evName(ev.id)}: ${slot(p?.slotId)}`);
        L.push(`    La dan: ${p?.performerIds.length ? p.performerIds.map(name).join(", ") : "— nadie —"}`);
        if (sup.length) L.push(`    Cambios que entran: ${sup.map(name).join(", ")}`);
        if (falt.length) L.push(`    Del grupo no dan: ${falt.map(name).join(", ")}`);
      }
      L.push("");
    }
  }

  if (kind === "talmidim") {
    L.push("TALMIDIM", "=".repeat(60), "");
    for (const r of [...diag.byTalmid].sort((a, b) => a.talmid.name.localeCompare(b.talmid.name, "es"))) {
      L.push(`${r.talmid.name}`);
      L.push(`  Grupo: ${r.group?.name ?? "— sin grupo —"}`);
      if (!r.executions.length) L.push("  Peulot: — ninguna —");
      for (const e of r.executions) {
        L.push(`  ${slot(e.slotId)} · ${e.groupName} (${evName(e.eventId)}) ${e.own ? "[planificó]" : "[cambio]"}`);
      }
      for (const i of r.issues) L.push(`  ${i.level === "error" ? "!!" : i.level === "warn" ? "!" : "·"} ${i.message}`);
      L.push("");
    }
  }

  if (kind === "dias") {
    L.push("AGENDA", "=".repeat(60), "");
    for (const ev of ds.events) {
      L.push(`— ${evName(ev.id).toUpperCase()} —`);
      for (const s of ds.slots.filter((x) => x.eventId === ev.id)) {
        const peulot = plan.groups.filter((g) => g.peulot[ev.id]?.slotId === s.id);
        L.push(`  ${s.label}`);
        if (!peulot.length) L.push("    (sin peulot)");
        for (const g of peulot) {
          const p = g.peulot[ev.id];
          const sup = p.performerIds.filter((i) => !g.memberIds.includes(i));
          L.push(`    ${g.name}: ${p.performerIds.map(name).join(", ") || "— nadie —"}${sup.length ? `  (cambios: ${sup.map(name).join(", ")})` : ""}`);
        }
      }
      L.push("");
    }
  }

  if (kind === "cambios") {
    L.push("CAMBIOS Y SUPLENCIAS", "=".repeat(60), "");
    let n = 0;
    for (const g of plan.groups) {
      for (const ev of ds.events) {
        const p = g.peulot[ev.id];
        if (!p) continue;
        const entran = p.performerIds.filter((i) => !g.memberIds.includes(i));
        const salen = g.memberIds.filter((i) => !p.performerIds.includes(i));
        if (!entran.length && !salen.length) continue;
        n++;
        L.push(`${g.name} · ${evName(ev.id)} · ${slot(p.slotId)}`);
        if (salen.length) L.push(`  No pueden dar la suya: ${salen.map(name).join(", ")}`);
        if (entran.length) L.push(`  Entran de otros grupos: ${entran.map(name).join(", ")}`);
        L.push(`  Queda dada por ${p.performerIds.length} persona(s).`);
        L.push("");
      }
    }
    if (!n) L.push("No hay ningún cambio: cada grupo da sus dos peulot completo.");
  }

  if (kind === "csv") {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    L.push(["Talmid", "Grupo", "Evento", "Día", "Grupo de la peulá", "Rol"].map(esc).join(","));
    for (const r of [...diag.byTalmid].sort((a, b) => a.talmid.name.localeCompare(b.talmid.name, "es"))) {
      if (!r.executions.length) {
        L.push([r.talmid.name, r.group?.name ?? "", "", "", "", "sin peulá"].map(esc).join(","));
        continue;
      }
      for (const e of r.executions) {
        L.push(
          [r.talmid.name, r.group?.name ?? "", evName(e.eventId), slot(e.slotId), e.groupName, e.own ? "planificó" : "cambio"]
            .map(esc)
            .join(","),
        );
      }
    }
  }

  return L.join("\n").trimEnd() + "\n";
}
