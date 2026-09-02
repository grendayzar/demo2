"use client";
import { useMemo, useState } from "react";
import { Icon } from "@/components/shell/Icon";

export interface PickBusiness { id: string; name: string; business_type: string; city: string | null; address: string | null; next_visit_due: string | null; status: string; assigned_rep_id: string | null; lat: number | null; lng: number | null }

export function RouteBuilder({ businesses, myId, initial = [], today, name = "stops", showCount = true }: { businesses: PickBusiness[]; myId: string; initial?: string[]; today: string; name?: string; showCount?: boolean }) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"mine" | "due" | "all">("mine");
  const byId = useMemo(() => new Map(businesses.map((b) => [b.id, b])), [businesses]);

  const candidates = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return businesses
      .filter((b) => !selected.includes(b.id))
      .filter((b) => (scope === "mine" ? b.assigned_rep_id === myId : scope === "due" ? !!b.next_visit_due && b.next_visit_due <= today : true))
      .filter((b) => !qq || `${b.name} ${b.business_type} ${b.city ?? ""} ${b.address ?? ""}`.toLowerCase().includes(qq))
      .sort((a, b) => (a.next_visit_due ?? "9999").localeCompare(b.next_visit_due ?? "9999") || a.name.localeCompare(b.name))
      .slice(0, 60);
  }, [businesses, selected, q, scope, myId, today]);

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= selected.length) return;
    const next = [...selected];
    [next[i], next[j]] = [next[j], next[i]];
    setSelected(next);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <input type="hidden" name={name} value={JSON.stringify(selected)} />
      <section className="card">
        <div className="card-head"><h3>Planned stops{showCount ? ` (${selected.length})` : ""}</h3></div>
        {selected.length === 0 ? (
          <div className="p-4 text-[13px] text-ts">Pick stops from the right. Order them the way you'll drive.</div>
        ) : (
          <ol>
            {selected.map((id, i) => {
              const b = byId.get(id);
              if (!b) return null;
              return (
                <li key={id} className="lrow">
                  <span className="w-7 h-7 rounded-full bg-brand text-black grid place-items-center text-[12px] font-extrabold flex-none">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-[13.5px] truncate">{b.name}</div>
                    <div className="text-[11.5px] text-tt truncate">{b.business_type}{b.city ? ` · ${b.city}` : ""}</div>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                  <button type="button" className="btn btn-ghost btn-sm text-bad" onClick={() => setSelected(selected.filter((x) => x !== id))} aria-label="Remove"><Icon name="x" size={16} /></button>
                </li>
              );
            })}
          </ol>
        )}
      </section>
      <section className="card">
        <div className="card-head">
          <h3>Add stops</h3>
          <div className="flex gap-1">
            {(["mine", "due", "all"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setScope(s)} className={`chip ${scope === s ? "on" : ""}`}>{s === "mine" ? "My stops" : s === "due" ? "Due" : "Territory"}</button>
            ))}
          </div>
        </div>
        <div className="p-3 border-b border-line2">
          <input className="input" placeholder="Search name, type, city…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {candidates.length === 0 && <div className="p-4 text-[13px] text-ts">No matches.</div>}
          {candidates.map((b) => {
            const overdue = b.next_visit_due && b.next_visit_due < today;
            return (
              <button type="button" key={b.id} className="lrow" onClick={() => setSelected([...selected, b.id])}>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[13.5px] truncate">{b.name}</div>
                  <div className="text-[11.5px] text-tt truncate">{b.business_type}{b.city ? ` · ${b.city}` : ""}{b.next_visit_due ? ` · due ${b.next_visit_due}` : ""}</div>
                </div>
                {overdue && <span className="pill pill-bad">overdue</span>}
                {b.status === "prospect" && <span className="pill pill-brand">new</span>}
                <Icon name="plus" size={16} className="text-tt" />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
