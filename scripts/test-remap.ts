import { readFileSync } from "node:fs";
import { buildDataset } from "../lib/parse";
import { diagnose } from "../lib/model";
import { solve } from "../lib/solver";
import { remapPlan } from "../lib/storage";
import { DEFAULT_SETTINGS } from "../lib/types";

const csv = readFileSync(process.argv[2], "utf8");
const a = buildDataset(csv, "v1");
if (!a.ok) throw new Error(a.error);
const ds1 = a.dataset;
const { plan } = solve(ds1, DEFAULT_SETTINGS, { restarts: 12, iterations: 600, seed: 5 });
console.log("v1:", diagnose(ds1, plan).stats);

// Simula que el sheet cambió: se agrega un talmid, se va otro, y alguien
// cambia una disponibilidad.
const rows = csv.split("\n").filter(Boolean);
rows.splice(3, 1); // se va Ian Pelzmajer
rows.push("Nuevo Talmid,TRUE,TRUE,FALSE,TRUE,TRUE,FALSE,TRUE");
rows[1] = "Ailin Kassir,TRUE,FALSE,FALSE,FALSE,TRUE,TRUE,FALSE"; // ahora sí puede el 22/09
const b = buildDataset(rows.join("\n"), "v2");
if (!b.ok) throw new Error(b.error);
const ds2 = b.dataset;

const { plan: plan2, notes } = remapPlan(ds1, ds2, plan);
console.log("\nnotas del remapeo:");
for (const n of notes) console.log("  -", n);

const d2 = diagnose(ds2, plan2);
console.log("\nv2:", d2.stats);
const gruposIguales = plan2.groups.length === plan.groups.length;
console.log("grupos conservados:", gruposIguales, "| días conservados:",
  plan2.groups.every((g) => Object.values(g.peulot).every((p) => p.slotId)));
console.log("\nerrores esperables tras el cambio:");
for (const t of d2.byTalmid) for (const i of t.issues) if (i.level === "error") console.log(`  [${t.talmid.name}] ${i.message}`);
for (const g of d2.byGroup) for (const i of g.issues) if (i.level === "error") console.log(`  [${g.group.name}] ${i.message}`);
