"use client";

import { useState } from "react";
import { CalendarDays, FileText, Sparkles, Table2, Users, Wand2 } from "lucide-react";
import AutoTab from "@/components/AutoTab";
import CalendarioTab from "@/components/CalendarioTab";
import DatosTab from "@/components/DatosTab";
import DisponibilidadTab from "@/components/DisponibilidadTab";
import GruposTab from "@/components/GruposTab";
import ReportesTab from "@/components/ReportesTab";
import { Badge, Stat, cx } from "@/components/ui";
import { useStore } from "@/lib/store";

const TABS = [
  { id: "datos", label: "Datos", icon: Table2, Comp: DatosTab },
  { id: "disponibilidades", label: "Disponibilidades", icon: Users, Comp: DisponibilidadTab },
  { id: "grupos", label: "Grupos", icon: Sparkles, Comp: GruposTab },
  { id: "auto", label: "Armado automático", icon: Wand2, Comp: AutoTab },
  { id: "calendario", label: "Calendario", icon: CalendarDays, Comp: CalendarioTab },
  { id: "reportes", label: "Reportes", icon: FileText, Comp: ReportesTab },
] as const;

export default function Page() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("datos");
  const { ds, diag, state } = useStore();
  const Active = TABS.find((t) => t.id === tab)!.Comp;
  const s = diag?.stats;
  const target = state.plan.settings.targetPerTalmid;
  const sinArmar = state.plan.groups.length === 0;

  return (
    <main className="mx-auto w-full max-w-[92rem] flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Armador de Iamim Noraim</h1>
          <p className="mt-1 text-sm text-muted">
            Grupos de planificación de {state.plan.settings.minSize} a {state.plan.settings.maxSize} talmidim, una peulá por
            evento, y los cambios de ejecución resueltos.
          </p>
        </div>
        {ds ? (
          <Badge variant="accent">
            {ds.talmidim.length} talmidim · {ds.slots.length} días · {ds.events.length} eventos
          </Badge>
        ) : null}
      </header>

      {s ? (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Talmidim" value={s.talmidim} hint={`${s.agrupados} en un grupo`} />
          <Stat label="Grupos" value={s.grupos} hint={`${s.gruposCompletos} con los dos días`} />
          <Stat
            label={`Dan ${target} peulot`}
            value={`${s.conDosPeulot}/${s.talmidim}`}
            tone={sinArmar ? undefined : s.conDosPeulot === s.talmidim ? "ok" : "warn"}
          />
          <Stat
            label="Ejecutan lo suyo"
            value={`${s.conPropiaPeula}/${s.talmidim}`}
            hint={`${s.suplencias} cambio(s)`}
            tone={sinArmar ? undefined : s.conPropiaPeula === s.talmidim ? "ok" : "err"}
          />
          <Stat
            label="Problemas"
            value={sinArmar ? "—" : s.errores}
            hint={sinArmar ? "todavía no armaste grupos" : `${s.advertencias} advertencia(s)`}
            tone={sinArmar ? undefined : s.errores ? "err" : "ok"}
          />
        </div>
      ) : null}

      <nav className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-line bg-panel p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                tab === t.id ? "bg-accent text-accent-fg" : "text-muted hover:bg-panel-2 hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </nav>

      <Active />
    </main>
  );
}
