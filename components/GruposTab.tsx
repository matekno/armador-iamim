"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Plus, RotateCcw, Sparkles, Trash2, UserPlus, Users, X } from "lucide-react";
import { coverage, type Index } from "@/lib/model";
import { useStore } from "@/lib/store";
import type { Dataset, Group } from "@/lib/types";
import { Badge, Button, Card, CardHead, Empty, Input, Note, Select, cx, tone } from "./ui";

export default function GruposTab() {
  const { ds, idx, diag, state, dispatch } = useStore();
  const [sel, setSel] = useState<string[]>([]);

  const sinGrupo = useMemo(
    () => (ds && idx ? ds.talmidim.filter((t) => !idx.groupOf.has(t.id)) : []),
    [ds, idx],
  );

  if (!ds || !idx || !diag) {
    return (
      <Card>
        <Empty icon={<Users className="h-8 w-8" />} title="Importá el sheet primero">
          Andá a la solapa <strong>Datos</strong>.
        </Empty>
      </Card>
    );
  }

  const { minSize, maxSize } = state.plan.settings;

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
      <div className="space-y-4 lg:sticky lg:top-4">
        <Card>
          <CardHead title="Sin grupo" subtitle={`${sinGrupo.length} talmid(im)`} icon={<UserPlus className="h-4 w-4" />} />
          <div className="p-4">
            {sinGrupo.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-ok">
                <CheckCircle2 className="h-4 w-4" /> Están todos asignados.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {sinGrupo.map((t) => {
                    const activo = sel.includes(t.id);
                    const libres = Object.values(t.avail).filter(Boolean).length;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSel((s) => (activo ? s.filter((x) => x !== t.id) : [...s, t.id]))}
                        className={cx(
                          "rounded-full border px-2.5 py-1 text-xs transition-colors",
                          activo ? "border-accent bg-accent text-accent-fg" : "border-line-strong hover:bg-panel-2",
                          libres === 0 && !activo && "text-err",
                        )}
                        title={`${libres} día(s) disponible(s)`}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={sel.length < minSize || sel.length > maxSize}
                    onClick={() => {
                      dispatch({ type: "createGroup", memberIds: sel });
                      setSel([]);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Crear grupo ({sel.length})
                  </Button>
                  {sel.length ? (
                    <Button size="sm" variant="ghost" onClick={() => setSel([])}>
                      Limpiar
                    </Button>
                  ) : null}
                </div>
                {sel.length > 0 && (sel.length < minSize || sel.length > maxSize) ? (
                  <p className="mt-2 text-xs text-warn">
                    Un grupo tiene que tener entre {minSize} y {maxSize} talmidim.
                  </p>
                ) : null}
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardHead title="Reglas" icon={<Sparkles className="h-4 w-4" />} />
          <div className="space-y-3 p-4">
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-xs text-muted">Mínimo por grupo</span>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={minSize}
                  onChange={(e) => dispatch({ type: "setSettings", settings: { minSize: Number(e.target.value) || 1 } })}
                  className="h-8 w-full"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">Máximo por grupo</span>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={maxSize}
                  onChange={(e) => dispatch({ type: "setSettings", settings: { maxSize: Number(e.target.value) || 1 } })}
                  className="h-8 w-full"
                />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-xs text-muted">Peulot que da cada talmid</span>
              <Input
                type="number"
                min={1}
                max={4}
                value={state.plan.settings.targetPerTalmid}
                onChange={(e) =>
                  dispatch({ type: "setSettings", settings: { targetPerTalmid: Number(e.target.value) || 1 } })
                }
                className="h-8 w-full"
              />
            </label>
            <Button
              size="sm"
              className="w-full"
              onClick={() => dispatch({ type: "autoFill" })}
              disabled={!state.plan.groups.length}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Recalcular cambios y suplencias
            </Button>
            <p className="text-xs leading-relaxed text-muted">
              Rearma quién da cada peulá: primero cada uno con su grupo, y después los cambios para que todos lleguen a{" "}
              {state.plan.settings.targetPerTalmid} peulot.
            </p>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        {state.plan.groups.length === 0 ? (
          <Card>
            <Empty icon={<Users className="h-8 w-8" />} title="Todavía no hay grupos">
              Seleccioná talmidim de la izquierda para crear el primero, o usá la solapa <strong>Armado automático</strong>.
            </Empty>
          </Card>
        ) : (
          state.plan.groups.map((g) => <GroupCard key={g.id} g={g} ds={ds} idx={idx} />)
        )}
      </div>
    </div>
  );
}

function GroupCard({ g, ds, idx }: { g: Group; ds: Dataset; idx: Index }) {
  const { diag, state, dispatch } = useStore();
  const report = diag!.byGroup.find((r) => r.group.id === g.id)!;
  const errores = report.issues.filter((i) => i.level === "error");
  const avisos = report.issues.filter((i) => i.level === "warn");
  const name = (id: string) => idx.talmidById.get(id)?.name ?? id;
  const sinGrupo = ds.talmidim.filter((t) => !idx.groupOf.has(t.id));

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <Input
          value={g.name}
          onChange={(e) => dispatch({ type: "renameGroup", groupId: g.id, name: e.target.value })}
          className="h-8 w-44 font-semibold"
        />
        <Badge>{g.memberIds.length} talmidim</Badge>
        {report.fullDayCount > 0 ? (
          <Badge variant="ok">
            <CheckCircle2 className="h-3 w-3" />
            {report.fullDayCount === 1 ? "un día con el grupo entero" : "los dos días completos"}
          </Badge>
        ) : null}
        {errores.length ? (
          <Badge variant="err">
            <AlertTriangle className="h-3 w-3" />
            {errores.length}
          </Badge>
        ) : null}
        {avisos.length ? <Badge variant="warn">{avisos.length}</Badge> : null}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto text-err"
          onClick={() => {
            if (confirm(`¿Borrar ${g.name}?`)) dispatch({ type: "deleteGroup", groupId: g.id });
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-4 py-2.5">
        <span className="mr-1 text-xs font-medium text-muted">Planifican:</span>
        {g.memberIds.map((m) => (
          <span key={m} className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-panel-2 py-0.5 pl-2.5 pr-1 text-xs">
            {name(m)}
            <button
              onClick={() => dispatch({ type: "removeMember", groupId: g.id, talmidId: m })}
              className="rounded-full p-0.5 hover:bg-err-soft hover:text-err"
              title="Sacar del grupo"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {sinGrupo.length && g.memberIds.length < state.plan.settings.maxSize ? (
          <Select
            value=""
            onChange={(e) => e.target.value && dispatch({ type: "addMember", groupId: g.id, talmidId: e.target.value })}
            className="h-7 w-40 text-xs"
          >
            <option value="">+ agregar…</option>
            {sinGrupo.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      <div className="grid gap-px bg-panel sm:grid-cols-2">
        {ds.events.map((ev) => (
          <PeulaBlock key={ev.id} g={g} eventId={ev.id} ds={ds} idx={idx} />
        ))}
      </div>

      {errores.length || avisos.length ? (
        <div className="space-y-1.5 border-t border-line p-3">
          {errores.map((i, k) => (
            <Note key={`e${k}`} level="error">
              {i.message}
            </Note>
          ))}
          {avisos.map((i, k) => (
            <Note key={`w${k}`} level="warn">
              {i.message}
            </Note>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function PeulaBlock({ g, eventId, ds, idx }: { g: Group; eventId: string; ds: Dataset; idx: Index }) {
  const { state, dispatch } = useStore();
  const ev = ds.events.find((e) => e.id === eventId)!;
  const t = tone(ev.tone);
  const p = g.peulot[eventId] ?? { slotId: null, performerIds: [] };
  const slots = idx.slotsByEvent.get(eventId) ?? [];
  const name = (id: string) => idx.talmidById.get(id)?.name ?? id;

  // Quién más está dando una peulá ese día (para no duplicar a nadie).
  const ocupadosEseDia = new Set<string>();
  if (p.slotId)
    for (const otro of state.plan.groups)
      for (const [evId, op] of Object.entries(otro.peulot))
        if (op.slotId === p.slotId && !(otro.id === g.id && evId === eventId))
          for (const id of op.performerIds) ocupadosEseDia.add(id);

  const suplentesPosibles = p.slotId
    ? ds.talmidim.filter(
        (x) =>
          !g.memberIds.includes(x.id) &&
          !p.performerIds.includes(x.id) &&
          x.avail[p.slotId!] === true &&
          !ocupadosEseDia.has(x.id),
      )
    : [];

  const suplentes = p.performerIds.filter((id) => !g.memberIds.includes(id));

  return (
    <div className="bg-panel p-4 outline outline-1 -outline-offset-[0.5px] outline-line">
      <div className="mb-2.5 flex items-center gap-2">
        <span className={cx("h-2 w-2 rounded-full", t.dot)} />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{ev.name}</span>
      </div>

      <Select
        value={p.slotId ?? ""}
        onChange={(e) => dispatch({ type: "setSlot", groupId: g.id, eventId, slotId: e.target.value || null })}
        className={cx("h-8 w-full text-xs", !p.slotId && "text-muted")}
      >
        <option value="">Elegir día…</option>
        {slots.map((s) => {
          const cov = coverage(g, s.id, idx);
          return (
            <option key={s.id} value={s.id}>
              {s.label} — {cov.available}/{cov.total} pueden
            </option>
          );
        })}
      </Select>

      {p.slotId ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">La dan ({p.performerIds.length})</span>
            <button
              onClick={() => dispatch({ type: "resetRoster", groupId: g.id, eventId })}
              className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink"
              title="Volver al grupo que puede ese día"
            >
              <RotateCcw className="h-3 w-3" /> restablecer
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {g.memberIds.map((m) => {
              const puede = idx.talmidById.get(m)?.avail[p.slotId!] === true;
              const da = p.performerIds.includes(m);
              return (
                <button
                  key={m}
                  disabled={!puede}
                  onClick={() => dispatch({ type: "togglePerformer", groupId: g.id, eventId, talmidId: m })}
                  className={cx(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    !puede
                      ? "cursor-not-allowed border-line bg-panel-2 text-muted line-through"
                      : da
                        ? "border-ok/30 bg-ok-soft text-ok"
                        : "border-line-strong hover:bg-panel-2",
                  )}
                  title={!puede ? "No puede este día" : da ? "Da la peulá" : "No la está dando"}
                >
                  {name(m)}
                </button>
              );
            })}
            {suplentes.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent-soft py-1 pl-2.5 pr-1 text-xs text-accent"
                title="Cambio: da una peulá que no planificó"
              >
                {name(s)}
                <span className="rounded bg-accent/15 px-1 text-[9px] font-semibold uppercase">cambio</span>
                <button
                  onClick={() => dispatch({ type: "togglePerformer", groupId: g.id, eventId, talmidId: s })}
                  className="rounded-full p-0.5 hover:bg-err-soft hover:text-err"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          {suplentesPosibles.length ? (
            <Select
              value=""
              onChange={(e) => e.target.value && dispatch({ type: "togglePerformer", groupId: g.id, eventId, talmidId: e.target.value })}
              className="h-7 w-full text-xs"
            >
              <option value="">+ sumar a alguien de otro grupo…</option>
              {suplentesPosibles.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
