"use client";

import { useState } from "react";
import { CheckCircle2, Dices, Lock, Play, Wand2, XCircle } from "lucide-react";
import { diagnose } from "@/lib/model";
import { solve } from "@/lib/solver";
import { useStore } from "@/lib/store";
import type { Plan } from "@/lib/types";
import { Badge, Button, Card, CardHead, Empty, Input, Note, Select, Stat, Toggle, cx, tone } from "./ui";

export default function AutoTab() {
  const { ds, state, dispatch } = useStore();
  const [preferredSize, setPreferredSize] = useState(4);
  const [calidad, setCalidad] = useState<"rapido" | "normal" | "fino">("normal");
  const [spread, setSpread] = useState(true);
  const [seed, setSeed] = useState(1);
  const [locked, setLocked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ plan: Plan; score: number } | null>(null);

  if (!ds) {
    return (
      <Card>
        <Empty icon={<Wand2 className="h-8 w-8" />} title="Importá el sheet primero">
          Andá a la solapa <strong>Datos</strong>.
        </Empty>
      </Card>
    );
  }

  const params = { rapido: { restarts: 8, iterations: 400 }, normal: { restarts: 24, iterations: 1200 }, fino: { restarts: 60, iterations: 3000 } }[calidad];

  const run = (nuevoSeed = seed) => {
    setBusy(true);
    setSeed(nuevoSeed);
    setTimeout(() => {
      const res = solve(ds, state.plan.settings, {
        preferredSize,
        spread,
        seed: nuevoSeed,
        lockedGroupIds: locked,
        existingGroups: state.plan.groups,
        ...params,
      });
      setPreview({ plan: res.plan, score: res.score });
      setBusy(false);
    }, 20);
  };

  const diag = preview ? diagnose(ds, preview.plan) : null;
  const name = (id: string) => ds.talmidim.find((t) => t.id === id)?.name ?? id;
  const slotLabel = (id: string | null) => ds.slots.find((s) => s.id === id)?.label ?? "sin día";

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
      <div className="space-y-4 lg:sticky lg:top-4">
        <Card>
          <CardHead title="Armado automático" subtitle="Arma los grupos, elige los días y reparte los cambios." icon={<Wand2 className="h-4 w-4" />} />
          <div className="space-y-4 p-4">
            <label className="block space-y-1">
              <span className="text-xs text-muted">Tamaño ideal de grupo</span>
              <Input
                type="number"
                min={state.plan.settings.minSize}
                max={state.plan.settings.maxSize}
                value={preferredSize}
                onChange={(e) => setPreferredSize(Number(e.target.value) || 4)}
                className="h-8 w-full"
              />
              <span className="text-[11px] text-muted">
                Entre {state.plan.settings.minSize} y {state.plan.settings.maxSize} (se ajusta en la solapa Grupos).
              </span>
            </label>

            <label className="block space-y-1">
              <span className="text-xs text-muted">Cuánto buscar</span>
              <Select value={calidad} onChange={(e) => setCalidad(e.target.value as typeof calidad)} className="h-8 w-full text-xs">
                <option value="rapido">Rápido</option>
                <option value="normal">Normal</option>
                <option value="fino">Fino (tarda unos segundos)</option>
              </Select>
            </label>

            <Toggle checked={spread} onChange={setSpread} label="Repartir las peulot entre los días" />

            {state.plan.groups.length > 0 ? (
              <div className="space-y-1.5">
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Lock className="h-3 w-3" /> Grupos a respetar
                </span>
                {state.plan.groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={locked.includes(g.id)}
                      onChange={(e) => setLocked((l) => (e.target.checked ? [...l, g.id] : l.filter((x) => x !== g.id)))}
                    />
                    {g.name} <span className="text-muted">({g.memberIds.length})</span>
                  </label>
                ))}
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => run(seed)} disabled={busy}>
                <Play className="h-4 w-4" />
                {busy ? "Armando…" : "Armar"}
              </Button>
              <Button onClick={() => run(seed + 1)} disabled={busy} title="Otra variante">
                <Dices className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-[11px] leading-relaxed text-muted">
              Prioriza que cada talmid pueda alguno de los dos días de su grupo (así ejecuta lo que planificó), después que
              haya un día con el grupo entero, y por último que todos lleguen a {state.plan.settings.targetPerTalmid} peulot.
            </p>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        {!preview ? (
          <Card>
            <Empty icon={<Wand2 className="h-8 w-8" />} title="Sin propuesta todavía">
              Configurá a la izquierda y tocá <strong>Armar</strong>. Vas a poder revisarla antes de aplicarla.
            </Empty>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Grupos" value={diag!.stats.grupos} />
              <Stat
                label={`Con ${state.plan.settings.targetPerTalmid} peulot`}
                value={`${diag!.stats.conDosPeulot}/${diag!.stats.talmidim}`}
                tone={diag!.stats.conDosPeulot === diag!.stats.talmidim ? "ok" : "warn"}
              />
              <Stat
                label="Ejecutan lo que planificaron"
                value={`${diag!.stats.conPropiaPeula}/${diag!.stats.talmidim}`}
                tone={diag!.stats.conPropiaPeula === diag!.stats.talmidim ? "ok" : "err"}
              />
              <Stat
                label="Errores"
                value={diag!.stats.errores}
                hint={`${diag!.stats.advertencias} advertencia(s)`}
                tone={diag!.stats.errores ? "err" : "ok"}
              />
            </div>

            <Card>
              <CardHead
                title="Propuesta"
                subtitle={`${diag!.stats.suplencias} cambio(s) · ${diag!.stats.conDiaCompleto}/${diag!.stats.grupos} grupos con un día completo · variante #${seed}`}
                action={
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>
                      <XCircle className="h-3.5 w-3.5" />
                      Descartar
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        dispatch({ type: "setPlan", plan: preview.plan });
                        setPreview(null);
                      }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Aplicar
                    </Button>
                  </div>
                }
              />
              <div className="divide-y divide-line">
                {preview.plan.groups.map((g) => {
                  const rep = diag!.byGroup.find((r) => r.group.id === g.id)!;
                  return (
                    <div key={g.id} className="p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{g.name}</span>
                        <span className="text-sm text-muted">{g.memberIds.map(name).join(", ")}</span>
                        {rep.fullDayCount > 0 ? <Badge variant="ok">día completo</Badge> : null}
                        {rep.issues.some((i) => i.level === "error") ? <Badge variant="err">revisar</Badge> : null}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {ds.events.map((ev) => {
                          const p = g.peulot[ev.id];
                          const sup = p?.performerIds.filter((i) => !g.memberIds.includes(i)) ?? [];
                          const faltan = g.memberIds.filter((i) => !p?.performerIds.includes(i));
                          return (
                            <div key={ev.id} className={cx("rounded-lg border border-line p-2.5 text-xs", tone(ev.tone).head)}>
                              <div className="font-medium">{slotLabel(p?.slotId ?? null)}</div>
                              <div className="mt-1 text-muted">
                                Dan: {p?.performerIds.length ? p.performerIds.map(name).join(", ") : "—"}
                              </div>
                              {sup.length ? <div className="mt-0.5 text-accent">Cambio: {sup.map(name).join(", ")}</div> : null}
                              {faltan.length ? <div className="mt-0.5 text-warn">No puede(n): {faltan.map(name).join(", ")}</div> : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {diag!.stats.errores > 0 ? (
              <Note level="warn">
                Esta variante deja {diag!.stats.errores} problema(s) sin resolver. Probá otra variante con el dado, subí la
                búsqueda a «Fino», o cambiá el tamaño ideal de grupo. Si con ninguna cierra, es porque las disponibilidades
                del sheet no dan y hay que resolverlo a mano en la solapa Grupos.
              </Note>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
