"use client";

import { AlertTriangle, CalendarDays, CheckCircle2, ListChecks } from "lucide-react";
import { useStore } from "@/lib/store";
import { Badge, Card, CardHead, Empty, Note, cx, tone } from "./ui";

export default function CalendarioTab() {
  const { ds, idx, diag, state } = useStore();

  if (!ds || !idx || !diag) {
    return (
      <Card>
        <Empty icon={<CalendarDays className="h-8 w-8" />} title="Importá el sheet primero">
          Andá a la solapa <strong>Datos</strong>.
        </Empty>
      </Card>
    );
  }

  const name = (id: string) => idx.talmidById.get(id)?.name ?? id;

  return (
    <div className="space-y-4">
      {ds.events.map((ev) => {
        const slots = ds.slots.filter((s) => s.eventId === ev.id);
        const t = tone(ev.tone);
        return (
          <Card key={ev.id}>
            <CardHead
              title={
                <span className="flex items-center gap-2">
                  <span className={cx("h-2.5 w-2.5 rounded-full", t.dot)} />
                  {ev.name}
                </span>
              }
              subtitle={`${slots.length} día(s)`}
              icon={<CalendarDays className="h-4 w-4" />}
            />
            <div className="grid gap-px bg-panel md:grid-cols-2 xl:grid-cols-3">
              {slots.map((s) => {
                const peulot = state.plan.groups
                  .map((g) => ({ g, ev: ev.id, p: g.peulot[ev.id] }))
                  .filter((x) => x.p?.slotId === s.id);
                const dando = new Set(peulot.flatMap((x) => x.p.performerIds));
                const libres = ds.talmidim.filter((x) => x.avail[s.id] && !dando.has(x.id));

                return (
                  <div key={s.id} className="min-h-40 bg-panel p-4 outline outline-1 -outline-offset-[0.5px] outline-line">
                    <div className="mb-3 flex items-baseline justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold capitalize">{s.weekday ? `${s.weekday} ` : ""}
                        {s.dateLabel ?? s.label}</p>
                        <p className="text-xs text-muted">{s.shift ?? s.label}</p>
                      </div>
                      <Badge variant={peulot.length ? "accent" : "neutral"}>
                        {peulot.length} peulá{peulot.length === 1 ? "" : "s"}
                      </Badge>
                    </div>

                    {peulot.length === 0 ? (
                      <p className="text-xs text-muted">Sin peulot este día.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {peulot.map(({ g, p }) => {
                          const ausentes = g.memberIds.filter((i) => !p.performerIds.includes(i));
                          return (
                            <div key={g.id} className={cx("rounded-lg border border-line p-2.5", t.head)}>
                              <p className="text-xs font-semibold">{g.name}</p>
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {p.performerIds.map((i) => (
                                  <span
                                    key={i}
                                    className={cx(
                                      "rounded-full border px-2 py-0.5 text-[11px]",
                                      g.memberIds.includes(i)
                                        ? "border-line-strong bg-panel"
                                        : "border-accent/30 bg-accent-soft text-accent",
                                    )}
                                    title={g.memberIds.includes(i) ? "Planificó esta peulá" : "Cambio: no la planificó"}
                                  >
                                    {name(i)}
                                  </span>
                                ))}
                                {!p.performerIds.length ? <span className="text-[11px] text-err">nadie asignado</span> : null}
                              </div>
                              {ausentes.length ? (
                                <p className="mt-1.5 text-[11px] text-muted">
                                  No dan: {ausentes.map(name).join(", ")}
                                </p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <p className="mt-3 border-t border-line pt-2 text-[11px] leading-relaxed text-muted">
                      <span className="font-medium">Libres este día ({libres.length}):</span>{" "}
                      {libres.length ? libres.map((x) => x.name).join(", ") : "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      <Card>
        <CardHead title="Estado por talmid" subtitle="Quién da qué, y qué falta resolver." icon={<ListChecks className="h-4 w-4" />} />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="border-b border-line px-4 py-2 font-medium">Talmid</th>
                <th className="border-b border-line px-4 py-2 font-medium">Grupo</th>
                <th className="border-b border-line px-4 py-2 font-medium">Peulot que da</th>
                <th className="border-b border-line px-4 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {diag.byTalmid.map((r) => {
                const errores = r.issues.filter((i) => i.level === "error");
                const avisos = r.issues.filter((i) => i.level === "warn");
                const infos = r.issues.filter((i) => i.level === "info");
                return (
                  <tr key={r.talmid.id} className="align-top">
                    <td className="border-b border-line px-4 py-2 font-medium">{r.talmid.name}</td>
                    <td className="border-b border-line px-4 py-2 text-muted">{r.group?.name ?? "—"}</td>
                    <td className="border-b border-line px-4 py-2">
                      {r.executions.length === 0 ? (
                        <span className="text-err">ninguna</span>
                      ) : (
                        <div className="space-y-0.5">
                          {r.executions.map((e, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs">
                              <span>{idx.slotById.get(e.slotId ?? "")?.label ?? "sin día"}</span>
                              <span className="text-muted">·</span>
                              <span className="text-muted">{e.groupName}</span>
                              {e.own ? (
                                <Badge variant="ok">planificó</Badge>
                              ) : (
                                <Badge variant="accent">cambio</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="border-b border-line px-4 py-2">
                      <div className="space-y-1">
                        {errores.length === 0 && avisos.length === 0 ? (
                          <span className="flex items-center gap-1 text-xs text-ok">
                            <CheckCircle2 className="h-3.5 w-3.5" /> ok
                          </span>
                        ) : null}
                        {errores.map((i, k) => (
                          <Note key={`e${k}`} level="error">
                            {i.message}
                          </Note>
                        ))}
                        {avisos.map((i, k) => (
                          <Note key={`w${k}`} level="warn">
                            <AlertTriangle className="mr-1 inline h-3 w-3 align-[-2px]" />
                            {i.message}
                          </Note>
                        ))}
                        {infos.map((i, k) => (
                          <Note key={`i${k}`} level="info">
                            {i.message}
                          </Note>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
