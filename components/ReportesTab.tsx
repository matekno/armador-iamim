"use client";

import { useState } from "react";
import { Check, Copy, Download, FileText } from "lucide-react";
import { REPORTS, buildReport, type ReportKind } from "@/lib/reports";
import { download } from "@/lib/storage";
import { useStore } from "@/lib/store";
import { Button, Card, CardHead, Empty, cx } from "./ui";

export default function ReportesTab() {
  const { ds, state } = useStore();
  const [kind, setKind] = useState<ReportKind>("grupos");
  const [copied, setCopied] = useState(false);

  if (!ds) {
    return (
      <Card>
        <Empty icon={<FileText className="h-8 w-8" />} title="Importá el sheet primero">
          Andá a la solapa <strong>Datos</strong>.
        </Empty>
      </Card>
    );
  }

  const text = buildReport(kind, ds, state.plan);
  const ext = kind === "csv" ? "csv" : "txt";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {REPORTS.map((r) => (
          <button
            key={r.id}
            onClick={() => setKind(r.id)}
            className={cx(
              "rounded-xl border p-3 text-left transition-colors",
              kind === r.id ? "border-accent bg-accent-soft" : "border-line bg-panel hover:bg-panel-2",
            )}
          >
            <p className="text-sm font-medium">{r.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{r.blurb}</p>
          </button>
        ))}
      </div>

      <Card>
        <CardHead
          title={REPORTS.find((r) => r.id === kind)!.title}
          icon={<FileText className="h-4 w-4" />}
          action={
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
              <Button size="sm" onClick={() => download(`iamim-${kind}.${ext}`, text, kind === "csv" ? "text/csv" : "text/plain")}>
                <Download className="h-3.5 w-3.5" />
                Descargar
              </Button>
            </div>
          }
        />
        <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed">
          {text}
        </pre>
      </Card>
    </div>
  );
}
