"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

/** Paleta por evento. Clases literales para que Tailwind las incluya. */
export const TONES = [
  {
    chip: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-400/15 dark:text-amber-200 dark:border-amber-400/25",
    dot: "bg-amber-500",
    head: "bg-amber-50 dark:bg-amber-400/10",
    ring: "ring-amber-300 dark:ring-amber-400/40",
  },
  {
    chip: "bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-400/15 dark:text-sky-200 dark:border-sky-400/25",
    dot: "bg-sky-500",
    head: "bg-sky-50 dark:bg-sky-400/10",
    ring: "ring-sky-300 dark:ring-sky-400/40",
  },
  {
    chip: "bg-violet-100 text-violet-900 border-violet-200 dark:bg-violet-400/15 dark:text-violet-200 dark:border-violet-400/25",
    dot: "bg-violet-500",
    head: "bg-violet-50 dark:bg-violet-400/10",
    ring: "ring-violet-300 dark:ring-violet-400/40",
  },
  {
    chip: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-400/15 dark:text-emerald-200 dark:border-emerald-400/25",
    dot: "bg-emerald-500",
    head: "bg-emerald-50 dark:bg-emerald-400/10",
    ring: "ring-emerald-300 dark:ring-emerald-400/40",
  },
];
export const tone = (i: number) => TONES[i % TONES.length];

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx("rounded-xl border border-line bg-panel shadow-[var(--shadow)]", className)}>{children}</div>
  );
}

export function CardHead({
  title,
  subtitle,
  icon,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? <span className="mt-0.5 text-muted">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-tight">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger" | "soft";
  size?: "sm" | "md";
};

export function Button({ variant = "outline", size = "md", className, ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45";
  const sizes = { sm: "h-8 px-2.5 text-xs", md: "h-9 px-3.5 text-sm" }[size];
  const variants = {
    primary: "bg-accent text-accent-fg hover:opacity-90",
    outline: "border border-line-strong bg-panel hover:bg-panel-2",
    soft: "bg-accent-soft text-accent hover:brightness-95",
    ghost: "hover:bg-panel-2",
    danger: "border border-err/30 bg-err-soft text-err hover:brightness-95",
  }[variant];
  return <button className={cx(base, sizes, variants, className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "h-9 rounded-lg border border-line-strong bg-panel px-3 text-sm placeholder:text-muted/70",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "h-9 appearance-none rounded-lg border border-line-strong bg-panel bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat px-3 pr-8 text-sm",
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round'><path d='m6 9 6 6 6-6'/></svg>\")",
      }}
      {...props}
    >
      {children}
    </select>
  );
}

export function Badge({
  children,
  className,
  variant = "neutral",
}: {
  children: ReactNode;
  className?: string;
  variant?: "neutral" | "ok" | "warn" | "err" | "accent";
}) {
  const variants = {
    neutral: "border-line bg-panel-2 text-muted",
    ok: "border-ok/25 bg-ok-soft text-ok",
    warn: "border-warn/25 bg-warn-soft text-warn",
    err: "border-err/25 bg-err-soft text-err",
    accent: "border-accent/25 bg-accent-soft text-accent",
  }[variant];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4",
        variants,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Stat({ label, value, hint, tone: t }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "ok" | "warn" | "err" }) {
  const color = t === "ok" ? "text-ok" : t === "warn" ? "text-warn" : t === "err" ? "text-err" : "text-ink";
  return (
    <Card className="px-4 py-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cx("mt-1 text-2xl font-semibold tabular-nums tracking-tight", color)}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon ? <div className="text-muted/60">{icon}</div> : null}
      <p className="text-sm font-medium">{title}</p>
      {children ? <div className="max-w-md text-sm text-muted">{children}</div> : null}
    </div>
  );
}

export function Note({ level, children }: { level: "error" | "warn" | "info" | "ok"; children: ReactNode }) {
  const styles = {
    error: "border-err/25 bg-err-soft text-err",
    warn: "border-warn/25 bg-warn-soft text-warn",
    info: "border-line bg-panel-2 text-muted",
    ok: "border-ok/25 bg-ok-soft text-ok",
  }[level];
  return <div className={cx("rounded-lg border px-3 py-2 text-xs leading-relaxed", styles)}>{children}</div>;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2 text-sm">
      <span
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        className={cx(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-line-strong",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
            checked ? "left-[1.125rem]" : "left-0.5",
          )}
        />
      </span>
      {label}
    </label>
  );
}
