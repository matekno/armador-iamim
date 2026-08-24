import { readFileSync } from "node:fs";
import { buildDataset } from "../lib/parse";
import { diagnose } from "../lib/model";
import { solve } from "../lib/solver";
import { DEFAULT_SETTINGS } from "../lib/types";

const csv = readFileSync(process.argv[2], "utf8");
const r = buildDataset(csv, "test");
if (!r.ok) { console.error("ERROR:", r.error); process.exit(1); }
const ds = r.dataset;

console.log("Eventos:");
for (const ev of ds.events) {
  const slots = ds.slots.filter((s) => s.eventId === ev.id);
  console.log(`  ${ev.id} ${ev.name}: ${slots.map((s) => s.label).join(" | ")}`);
}
console.log("Talmidim:", ds.talmidim.length);
console.log("Warnings:", r.warnings);

console.time("solve");
const { plan, score } = solve(ds, DEFAULT_SETTINGS, { preferredSize: 4, restarts: 20, iterations: 900, seed: 3 });
console.timeEnd("solve");
console.log("score:", score);

const name = (id: string) => ds.talmidim.find((t) => t.id === id)!.name;
const slotLabel = (id: string | null) => ds.slots.find((s) => s.id === id)?.label ?? "—";

for (const g of plan.groups) {
  console.log(`\n▸ ${g.name}  (${g.memberIds.length})`);
  for (const ev of ds.events) {
    const p = g.peulot[ev.id];
    const suplentes = p.performerIds.filter((i) => !g.memberIds.includes(i)).map(name);
    const ausentes = g.memberIds.filter((i) => !p.performerIds.includes(i)).map(name);
    console.log(
      `   ${ev.name.padEnd(14)} ${slotLabel(p.slotId).padEnd(26)} dan: ${p.performerIds.map(name).join(", ")}` +
        (suplentes.length ? `  [+suplentes: ${suplentes.join(", ")}]` : "") +
        (ausentes.length ? `  [faltan: ${ausentes.join(", ")}]` : ""),
    );
  }
}

const d = diagnose(ds, plan);
console.log("\n=== stats", d.stats);
console.log("\n=== errores:");
for (const g of d.byGroup) for (const i of g.issues) if (i.level === "error") console.log(`  [grupo ${g.group.name}] ${i.message}`);
for (const t of d.byTalmid) for (const i of t.issues) if (i.level === "error") console.log(`  [${t.talmid.name}] ${i.message}`);
for (const i of d.global) if (i.level === "error") console.log(`  [global] ${i.message}`);
console.log("=== advertencias:");
for (const g of d.byGroup) for (const i of g.issues) if (i.level === "warn") console.log(`  [grupo ${g.group.name}] ${i.message}`);
for (const t of d.byTalmid) for (const i of t.issues) if (i.level === "warn") console.log(`  [${t.talmid.name}] ${i.message}`);
for (const i of d.global) if (i.level === "warn") console.log(`  [global] ${i.message}`);
