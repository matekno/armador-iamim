"use client";

import { useMemo, useState } from "react";
import { Check, Minus, Search, Users, X } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Slot } from "@/lib/types";
import { Badge, Button, Card, CardHead, Empty, Input, Select, cx, tone } from "./ui";

export default function DisponibilidadTab() {
  const { ds, idx, state, dispatch } = useStore();
  const [q, setQ] = useState("");
  const [orden, setOrden] = useState<"nombre" | "disponibilidad" | "grupo">("nombre");
  const [filtro, setFiltro] = useState<"todos" | "sin-grupo" | "con-grupo">("todos");
  const [sel, setSel] = useState<string[]>([]);

  const filas = useMemo(() => {
    if (!ds || !idx) return [];
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let out = ds.talmidim.map((t) => ({
      t,
      libres: Object.values(t.avail).filter(Boolean).length,
      grupo: idx.groupOf.get(t.id),
    }));
    if (q.trim()) out = out.filter((r) => norm(r.t.name).includes(norm(q.trim())));
    if (filtro === "sin-grupo") out = out.filter((r) => !r.grupo);
    if (filtro === "con-grupo") out = out.filter((r) => r.grupo);
    out.sort((a, b) =>
      orden === "nombre"
        ? a.t.name.localeCompare(b.t.name, "es")
        : orden === "disponibilidad"
          ? b.libres - a.libres || a.t.name.localeCompare(b.t.name, "es")
          : (a.grupo?.name ?? "zzz").localeCompare(b.grupo?.name ?? "zzz", "es") || a.t.name.localeCompare(b.t.name, "es"),
    );
    return out;
  }, [ds, idx, q, orden, filtro]);

  if (!ds || !idx) {
    return (
      <Card>
        <Empty icon={<Users className="h-8 w-8" />} title="Importá el sheet primero">
          Andá a la solapa <strong>Datos</strong> y pegá el link del Google Sheets.
        </Empty>
      </Card>
    );
  }

  /** Días donde el talmid está anotado para ejecutar una peulá. */
  const ejecutaEn = new Map<string, Set<string>>();
  for (const g of state.plan.groups)
    for (const [, p] of Object.entries(g.peulot))
      for (const id of p.performerIds) {
        if (!p.slotId) continue;
        if (!ejecutaEn.has(id)) ejecutaEn.set(id, new Set());
        ejecutaEn.get(id)!.add(p.slotId);
      }

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const seleccionables = sel.filter((id) => !idx.groupOf.has(id));

  const grupos: Array<{ ev: (typeof ds.events)[number]; slots: Slot[] }> = ds.events.map((ev) => ({
    ev,
    slots: ds.slots.filter((s) => s.eventId === ev.id),
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHead
          title="Disponibilidades"
          subtitle="Clickeá los nombres para seleccionar y armar un grupo. El punto marca el día en que cada uno da una peulá."
          icon={<Users className="h-4 w-4" />}
        />

        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="h-8 w-44 pl-8 text-xs" />
          </div>
          <Select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} className="h-8 w-32 text-xs">
            <option value="todos">Todos</option>
            <option value="sin-grupo">Sin grupo</option>
            <option value="con-grupo">Con grupo</option>
          </Select>
          <Select value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)} className="h-8 w-44 text-xs">
            <option value="nombre">Orden: nombre</option>
            <option value="disponibilidad">Orden: disponibilidad</option>
            <option value="grupo">Orden: grupo</option>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-panel" />
                {grupos.map(({ ev, slots }) => (
                  <th
                    key={ev.id}
                    colSpan={slots.length}
                    className={cx(
                      "border-l border-line px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide",
                      tone(ev.tone).head,
                    )}
                  >
                    {ev.name}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 z-20 min-w-52 border-b border-line bg-panel px-4 py-2 text-left text-xs font-medium text-muted">
                  Talmid
                </th>
                {grupos.map(({ ev, slots }) =>
                  slots.map((s, i) => {
                    const t = tone(ev.tone);
                    const cuentan = ds.talmidim.filter((x) => x.avail[s.id]).length;
                    return (
                      <th
                        key={s.id}
                        title={s.label}
                        className={cx(
                          "border-b border-line px-2 pb-2 text-center align-bottom text-[11px] font-medium",
                          t.head,
                          i === 0 && "border-l border-line",
                        )}
                      >
                        <div className="whitespace-nowrap text-[10px] font-normal capitalize text-muted">
                          {s.weekday ?? "\u00a0"}
                        </div>
                        <div className="whitespace-nowrap">{s.dateLabel ?? s.label}</div>
                        <div className="whitespace-nowrap text-[10px] font-normal text-muted">{s.shift ?? "\u00a0"}</div>
                        <div className="mt-1 text-[10px] font-normal tabular-nums text-muted">{cuentan}</div>
                      </th>
                    );
                  }),
                )}
              </tr>
            </thead>
            <tbody>
              {filas.map(({ t, libres, grupo }) => {
                const activo = sel.includes(t.id);
                return (
                  <tr key={t.id} className={cx("group", activo && "bg-accent-soft")}>
                    <td
                      onClick={() => toggle(t.id)}
                      className={cx(
                        "sticky left-0 z-10 cursor-pointer border-b border-line px-4 py-1.5",
                        activo ? "bg-accent-soft" : "bg-panel group-hover:bg-panel-2",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cx("truncate", libres === 0 && "text-err")}>{t.name}</span>
                        {grupo ? (
                          <Badge variant="accent" className="shrink-0">
                            {grupo.name}
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    {grupos.map(({ slots }) =>
                      slots.map((s, i) => {
                        const puede = t.avail[s.id];
                        const da = ejecutaEn.get(t.id)?.has(s.id);
                        return (
                          <td
                            key={s.id}
                            className={cx(
                              "border-b border-line px-2 py-1.5 text-center",
                              i === 0 && "border-l border-line",
                              activo && "bg-accent-soft",
                            )}
                          >
                            <span className="relative inline-flex items-center justify-center">
                              {puede ? <Check className="h-4 w-4 text-ok" /> : <Minus className="h-4 w-4 text-line-strong" />}
                              {da ? (
                                <span
                                  title="Da una peulá este día"
                                  className="absolute -right-2 h-1.5 w-1.5 rounded-full bg-accent"
                                />
                              ) : null}
                            </span>
                          </td>
                        );
                      }),
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-muted">
          <span>
            Mostrando {filas.length} de {ds.talmidim.length} talmidim
          </span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Check className="h-3.5 w-3.5 text-ok" /> puede
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> da una peulá
            </span>
          </span>
        </div>
      </Card>

      {sel.length > 0 ? (
        <div className="sticky bottom-4 z-30 mx-auto flex w-fit items-center gap-3 rounded-full border border-line-strong bg-panel px-4 py-2 shadow-lg">
          <span className="text-sm">
            <strong>{sel.length}</strong> seleccionado(s)
            {sel.length !== seleccionables.length ? (
              <span className="text-muted"> · {sel.length - seleccionables.length} ya tiene(n) grupo</span>
            ) : null}
          </span>
          <Button
            size="sm"
            variant="primary"
            disabled={seleccionables.length < state.plan.settings.minSize || seleccionables.length > state.plan.settings.maxSize}
            onClick={() => {
              dispatch({ type: "createGroup", memberIds: seleccionables });
              setSel([]);
            }}
          >
            Crear grupo ({seleccionables.length})
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSel([])}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
