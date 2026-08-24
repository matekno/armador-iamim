"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  Check,
  Download,
  FileUp,
  Info,
  Link2,
  ListChecks,
  Loader2,
  RefreshCw,
  Table2,
  Trash2,
  Upload,
} from "lucide-react";
import { buildDataset } from "@/lib/parse";
import { download } from "@/lib/storage";
import { useStore } from "@/lib/store";
import type { AppState } from "@/lib/types";
import type { Polarity } from "@/lib/types";
import { Badge, Button, Card, CardHead, Input, Note, Select, Toggle, cx, tone } from "./ui";

const EJEMPLO = `,Lunes 22/09 TARDE,Martes 23/09 MAÑANA,Miércoles 01/10 TARDE
Ailin Kassir,FALSE,TRUE,TRUE
Eitan Moscovich,TRUE,TRUE,FALSE`;

export default function DatosTab() {
  const { state, ds, dispatch } = useStore();
  const [url, setUrl] = useState("");
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [info, setInfo] = useState<string[]>([]);
  const [ok, setOk] = useState<string | null>(null);
  const [keepPlan, setKeepPlan] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const ingest = (text: string, source: string) => {
    const result = buildDataset(text, source);
    if (!result.ok) {
      setError(result.error);
      setWarnings([]);
      setInfo([]);
      setOk(null);
      return;
    }
    setError(null);
    setWarnings(result.warnings);
    setInfo(result.info);
    setOk(`${result.dataset.talmidim.length} talmidim y ${result.dataset.slots.length} días importados.`);
    dispatch({ type: "setDataset", dataset: result.dataset, keepPlan: keepPlan && !!ds });
  };

  const importFromUrl = async (target = url) => {
    if (!target.trim()) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/sheet?url=${encodeURIComponent(target)}`);
      const data = (await res.json()) as { csv?: string; error?: string };
      if (!res.ok || !data.csv) setError(data.error ?? "No pude leer el sheet.");
      else ingest(data.csv, target);
    } catch {
      setError("Falló la conexión con el servidor.");
    } finally {
      setBusy(false);
    }
  };

  const exportJson = () => {
    download(`armado-iamim-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2), "application/json");
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as AppState;
      if (!parsed.plan) throw new Error("bad");
      dispatch({ type: "setState", state: { dataset: parsed.dataset ?? null, plan: parsed.plan } });
      setOk("Armado restaurado desde el archivo.");
      setError(null);
    } catch {
      setError("Ese archivo no es un armado válido.");
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card>
        <CardHead
          title="Importar disponibilidades"
          subtitle="Detecta sola la columna de nombres y las de días. Anda con la hoja de respuestas de un Google Form."
          icon={<Table2 className="h-4 w-4" />}
        />
        <div className="space-y-5 p-4 sm:p-5">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted">Link del Google Sheets</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && importFromUrl()}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full pl-8"
                />
              </div>
              <Button variant="primary" onClick={() => importFromUrl()} disabled={busy || !url.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Importar
              </Button>
            </div>
            <p className="text-xs text-muted">
              El sheet tiene que estar compartido como <strong>cualquier persona con el enlace</strong> (lector alcanza).
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" />o<span className="h-px flex-1 bg-line" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted">Pegar el contenido (CSV o directo desde el sheet)</label>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={5}
              spellCheck={false}
              placeholder={EJEMPLO}
              className="w-full rounded-lg border border-line-strong bg-panel p-3 font-mono text-xs leading-relaxed placeholder:text-muted/60"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => ingest(pasted, "pegado a mano")} disabled={!pasted.trim()}>
                <Check className="h-3.5 w-3.5" />
                Usar lo pegado
              </Button>
              <Button size="sm" onClick={() => fileRef.current?.click()}>
                <FileUp className="h-3.5 w-3.5" />
                Subir archivo .csv
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.tsv,.txt,text/csv"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) ingest(await f.text(), f.name);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          {ds ? <Toggle checked={keepPlan} onChange={setKeepPlan} label="Conservar los grupos ya armados al reimportar" /> : null}

          <div className="space-y-2">
            {error ? <Note level="error">{error}</Note> : null}
            {ok ? <Note level="ok">{ok}</Note> : null}
            {info.map((x, i) => (
              <Note key={`i${i}`} level="info">
                <Info className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
                {x}
              </Note>
            ))}
            {warnings.map((w, i) => (
              <Note key={i} level="warn">
                <AlertTriangle className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
                {w}
              </Note>
            ))}
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {ds ? <LecturaCard /> : null}

        <Card>
          <CardHead
            title="Eventos y días"
            subtitle="El corte se detecta por el salto de fechas. Podés reasignar cualquier día."
            icon={<CalendarRange className="h-4 w-4" />}
            action={
              ds ? (
                <Button size="sm" onClick={() => dispatch({ type: "addEvent" })}>
                  Nuevo evento
                </Button>
              ) : null
            }
          />
          {!ds ? (
            <p className="p-5 text-sm text-muted">Todavía no importaste ningún sheet.</p>
          ) : (
            <div className="divide-y divide-line">
              {ds.events.map((ev) => {
                const slots = ds.slots.filter((s) => s.eventId === ev.id);
                const t = tone(ev.tone);
                return (
                  <div key={ev.id} className="p-4 sm:p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <span className={cx("h-2.5 w-2.5 rounded-full", t.dot)} />
                      <Input
                        value={ev.name}
                        onChange={(e) => dispatch({ type: "renameEvent", eventId: ev.id, name: e.target.value })}
                        className="h-8 w-full max-w-64 font-medium"
                      />
                      <Badge>{slots.length} día(s)</Badge>
                    </div>
                    <div className="space-y-1.5">
                      {slots.map((s) => (
                        <div key={s.id} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm">{s.label}</span>
                          {!s.dateLabel ? <Badge variant="warn">sin fecha</Badge> : null}
                          <Select
                            value={s.eventId}
                            onChange={(e) => dispatch({ type: "moveSlot", slotId: s.id, eventId: e.target.value })}
                            className="h-8 w-40 text-xs"
                          >
                            {ds.events.map((e2) => (
                              <option key={e2.id} value={e2.id}>
                                {e2.name}
                              </option>
                            ))}
                          </Select>
                        </div>
                      ))}
                      {!slots.length ? <p className="text-xs text-muted">Sin días asignados.</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <CardHead title="Guardar y restaurar" subtitle="Todo se guarda solo en este navegador." icon={<Download className="h-4 w-4" />} />
          <div className="flex flex-wrap items-center gap-2 p-4 sm:p-5">
            <Button size="sm" onClick={exportJson} disabled={!ds}>
              <Download className="h-3.5 w-3.5" />
              Descargar armado
            </Button>
            <Button size="sm" onClick={() => jsonRef.current?.click()}>
              <FileUp className="h-3.5 w-3.5" />
              Restaurar
            </Button>
            <input
              ref={jsonRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importJson(f);
                e.target.value = "";
              }}
            />
            {ds?.sourceLabel?.startsWith("http") ? (
              <Button size="sm" onClick={() => importFromUrl(ds.sourceLabel)} disabled={busy}>
                <RefreshCw className={cx("h-3.5 w-3.5", busy && "animate-spin")} />
                Actualizar desde el sheet
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="danger"
              className="ml-auto"
              onClick={() => {
                if (confirm("Se borra el sheet importado y todos los grupos. ¿Seguro?")) dispatch({ type: "reset" });
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Empezar de cero
            </Button>
          </div>
          {ds ? (
            <p className="border-t border-line px-4 py-2.5 text-xs text-muted sm:px-5">
              Origen: <span className="font-mono">{ds.sourceLabel}</span> · importado el{" "}
              {new Date(ds.importedAt).toLocaleString("es-AR")}
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

const LECTURAS: Array<{ id: Polarity; title: string; blurb: string }> = [
  {
    id: "vacio-no-puede",
    title: "Se marca quién SÍ puede",
    blurb: "La planilla clásica: TRUE / SÍ / X en los días que puede. La celda vacía es que no puede.",
  },
  {
    id: "vacio-puede",
    title: "Se marca quién NO puede",
    blurb: "El form junta sólo las ausencias («No puedo venir»). La celda vacía es que sí puede.",
  },
];

/** Cómo interpretar las celdas: detectado al importar, corregible a mano. */
function LecturaCard() {
  const { ds, dispatch } = useStore();
  if (!ds) return null;

  const puede = ds.talmidim.reduce((a, t) => a + Object.values(t.avail).filter(Boolean).length, 0);
  const total = ds.talmidim.length * ds.slots.length;
  const sinCrudo = ds.talmidim.every((t) => !t.raw || Object.keys(t.raw).length === 0);

  return (
    <Card>
      <CardHead
        title="Lectura de las celdas"
        subtitle="Lo detecté al importar. Si quedó al revés, cambialo acá."
        icon={<ListChecks className="h-4 w-4" />}
      />
      <div className="space-y-3 p-4 sm:p-5">
        <div className="grid gap-2 sm:grid-cols-2">
          {LECTURAS.map((l) => (
            <button
              key={l.id}
              onClick={() => dispatch({ type: "setPolarity", polarity: l.id })}
              disabled={sinCrudo && l.id !== ds.polarity}
              className={cx(
                "rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                ds.polarity === l.id ? "border-accent bg-accent-soft" : "border-line hover:bg-panel-2",
              )}
            >
              <p className="text-sm font-medium">{l.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{l.blurb}</p>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          Así queda: <strong className="text-ink">{puede}</strong> de {total} casilleros cuentan como disponible.
        </p>
        {sinCrudo ? (
          <Note level="warn">
            Este sheet se importó con una versión anterior de la app y no guardó el texto original de las celdas.
            Reimportalo para poder cambiar la lectura.
          </Note>
        ) : null}
      </div>
    </Card>
  );
}
