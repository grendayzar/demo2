import Link from "next/link";
import type { ReactNode } from "react";
import { initials } from "@/lib/format";

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="pagehead">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, meta, children, className = "", actions, pad = true }: { title?: string; meta?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode; pad?: boolean }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          <h3>{title}</h3>
          <div className="flex items-center gap-2 text-[11.5px] text-tt">{meta}{actions}</div>
        </div>
      )}
      <div className={pad ? "card-body" : ""}>{children}</div>
    </section>
  );
}

export function Stat({ k, v, d, tone }: { k: string; v: ReactNode; d?: ReactNode; tone?: "ok" | "warn" | "bad" | "brand" }) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "";
  return (
    <div className="card stat">
      <div className="k">{k}</div>
      <div className={`v ${color}`}>{v}</div>
      {d && <div className="d">{d}</div>}
    </div>
  );
}

export function Pill({ tone = "neutral", children }: { tone?: "ok" | "warn" | "bad" | "info" | "neutral" | "brand"; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {hint && <span>{hint}</span>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Avatar({ name, src, size = 32, brand }: { name: string | null | undefined; src?: string | null; size?: number; brand?: boolean }) {
  return (
    <span className={`avatar ${brand ? "avatar-brand" : ""}`} style={{ width: size, height: size, fontSize: Math.round(size / 2.8) }}>
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : initials(name)}
    </span>
  );
}

export function BackLink({ href, label = "Back" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-ts hover:text-tp mb-3">
      <span aria-hidden>←</span> {label}
    </Link>
  );
}

export function Tabs({ items, active }: { items: { href: string; label: string; count?: number }[]; active: string }) {
  return (
    <nav className="tabs">
      {items.map((t) => (
        <Link key={t.href} href={t.href} className={`tab ${active === t.href ? "on" : ""}`}>
          {t.label}
          {t.count != null && <span className="ml-1.5 text-tt tabular">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function KV({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt>{k}</dt>
          <dd>{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function statusTone(status: string): "ok" | "warn" | "bad" | "info" | "neutral" | "brand" {
  switch (status) {
    case "active": case "reviewed": case "signed": case "fulfilled": case "sent": case "qualified": return "ok";
    case "in_progress": case "submitted": case "contacted": case "approved": return "info";
    case "prospect": case "planned": case "requested": case "new": case "pending_review": return "brand";
    case "paused": case "draft": case "on_request": return "warn";
    case "declined": case "ineligible": case "archived": case "cancelled": case "spam": return "bad";
    default: return "neutral";
  }
}
