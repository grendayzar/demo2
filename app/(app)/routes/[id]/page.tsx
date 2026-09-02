import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser, isManager } from "@/lib/auth";
import { Card, Pill, Stat, BackLink, Avatar, statusTone } from "@/components/ui";
import { Checklist } from "@/components/routes/Checklist";
import { StopsMap } from "@/components/map/StopsMap";
import { WeatherCard } from "@/components/weather/WeatherCard";
import { Toast } from "@/components/shell/Toast";
import { Icon } from "@/components/shell/Icon";
import { fday, ftime, num, titleCase, usd } from "@/lib/format";
import { startRoute, endRoute, interruptRoute, reviewRoute, deleteRoute, addExpense, addStopToRoute, removeStop, moveStop } from "../actions";
import type { RouteTask } from "@/lib/types";

export default async function RoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, role, user } = await requireUser();
  const { data: route } = await supabase.from("routes").select("*, rep:profiles!routes_rep_id_fkey(id,full_name,photo_url), territory:territories(*)").eq("id", id).maybeSingle();
  if (!route) notFound();
  const [{ data: stops }, { data: tasks }, { data: expenses }, { data: candidates }] = await Promise.all([
    supabase.from("stops").select("*, business:businesses(id,name,business_type,city,address,lat,lng,phone,status)").eq("route_id", id).order("seq"),
    supabase.from("route_tasks").select("*").eq("route_id", id),
    supabase.from("route_expenses").select("*").eq("route_id", id).order("created_at"),
    supabase.from("businesses").select("id,name,city").in("status", ["active", "prospect", "paused"]).order("name").limit(400),
  ]);
  const stopIds = (stops ?? []).map((s) => s.id);
  const { data: photoRows } = stopIds.length ? await supabase.from("stop_photos").select("stop_id").in("stop_id", stopIds) : { data: [] };
  const photoCount = new Map<string, number>();
  (photoRows ?? []).forEach((p) => photoCount.set(p.stop_id, (photoCount.get(p.stop_id) ?? 0) + 1));

  const mine = route.rep_id === user.id;
  const manager = isManager(role);
  const canEdit = mine || manager;
  const editable = canEdit && !["submitted", "reviewed"].includes(route.status);
  const done = (stops ?? []).filter((s) => s.completed_at).length;
  const total = (stops ?? []).length;
  const back = `/routes/${id}`;
  const expTotal = (expenses ?? []).reduce((a, e) => a + Number(e.amount), 0);
  const mileageCost = Number(route.mileage ?? 0) * Number(route.territory?.mileage_rate ?? 0.7);
  const mapPoints = (stops ?? []).filter((s) => s.business?.lat && s.business?.lng).map((s) => ({ id: s.id, lat: Number(s.business.lat), lng: Number(s.business.lng), label: s.business.name, sub: s.business.address ?? undefined, href: `/routes/${id}/stops/${s.id}`, done: !!s.completed_at, seq: s.seq }));
  const inRoute = new Set((stops ?? []).map((s) => s.business_id));
  const firstCity = (stops ?? []).find((s) => s.business?.city)?.business?.city ?? route.territory?.cities?.[0];

  return (
    <div>
      <Suspense><Toast /></Suspense>
      <BackLink href="/routes" label="Routes" />
      <div className="pagehead">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1>{fday(route.route_date)}</h1>
            <Pill tone={statusTone(route.status)}>{titleCase(route.status)}</Pill>
            {route.interrupted && <Pill tone="bad">Interrupted · {titleCase(route.interruption_reason)}</Pill>}
          </div>
          <p className="flex items-center gap-2 mt-1"><Avatar name={route.rep?.full_name} src={route.rep?.photo_url} size={22} /> {route.rep?.full_name} · {route.territory?.name ?? "No territory"} · {route.route_date}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {editable && route.status !== "in_progress" && (
            <form action={startRoute} className="flex gap-2 items-end">
              <input type="hidden" name="route_id" value={id} />
              <label className="field !mb-0 w-[130px]"><span>Odometer start</span><input type="number" name="odometer_start" inputMode="decimal" step="0.1" placeholder="miles" /></label>
              <button className="btn btn-pri"><Icon name="flag" size={16} /> Start route</button>
            </form>
          )}
          {manager && route.status === "submitted" && (
            <form action={reviewRoute}><input type="hidden" name="route_id" value={id} /><button className="btn btn-dark"><Icon name="check" size={16} /> Mark reviewed</button></form>
          )}
          {editable && route.status === "draft" && (
            <form action={deleteRoute}><input type="hidden" name="route_id" value={id} /><button className="btn btn-danger">Delete</button></form>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat k="Stops" v={`${done}/${total}`} d={total ? `${Math.round((100 * done) / total)}% complete` : undefined} />
        <Stat k="Started" v={ftime(route.started_at)} d={route.ended_at ? `Ended ${ftime(route.ended_at)}` : undefined} />
        <Stat k="Miles" v={route.mileage != null ? num(Number(route.mileage)) : "—"} d={route.odometer_start != null ? `Odometer ${num(Number(route.odometer_start))}${route.odometer_end != null ? ` → ${num(Number(route.odometer_end))}` : ""}` : "Enter odometer at start and end"} />
        <Stat k="Route cost" v={usd(expTotal + mileageCost)} d={`${usd(expTotal)} expenses + ${usd(mileageCost)} mileage`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          {mapPoints.length > 0 && <StopsMap points={mapPoints} height={260} />}
          <Card title="Stops" meta={`${done} of ${total} reported`} pad={false}>
            {(stops ?? []).map((s, i) => {
              const b = s.business;
              const badOutcome = s.outcome && !["materials_placed", "restocked", "verified_only"].includes(s.outcome);
              return (
                <div key={s.id} className="lrow">
                  <Link href={`/routes/${id}/stops/${s.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                    <span className={`w-8 h-8 rounded-full grid place-items-center text-[12px] font-extrabold flex-none ${s.completed_at ? (badOutcome ? "bg-warn-soft text-warn" : "bg-ok text-white") : s.arrived_at ? "bg-brand text-black" : "bg-line2 text-ts"}`}>{s.completed_at ? "✓" : s.seq}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-[13.5px] truncate">{b?.name ?? "Business"}</div>
                      <div className="text-[11.5px] text-tt truncate">
                        {s.completed_at ? `${titleCase(s.outcome ?? "reported")} · ${ftime(s.completed_at)}${photoCount.get(s.id) ? ` · ${photoCount.get(s.id)} photo${photoCount.get(s.id)! > 1 ? "s" : ""}` : " · no photo"}` : s.arrived_at ? `Arrived ${ftime(s.arrived_at)}` : `${b?.business_type ?? ""}${b?.city ? ` · ${b.city}` : ""}`}
                      </div>
                    </div>
                  </Link>
                  {b?.address && !s.completed_at && (
                    <a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b.address + (b.city ? ", " + b.city : ""))}`} aria-label="Navigate"><Icon name="navigate" size={16} /></a>
                  )}
                  {editable && !s.completed_at && (
                    <div className="hidden sm:flex">
                      <form action={moveStop}><input type="hidden" name="route_id" value={id} /><input type="hidden" name="stop_id" value={s.id} /><input type="hidden" name="dir" value="up" /><button className="btn btn-ghost btn-sm" disabled={i === 0} aria-label="Move up">↑</button></form>
                      <form action={moveStop}><input type="hidden" name="route_id" value={id} /><input type="hidden" name="stop_id" value={s.id} /><input type="hidden" name="dir" value="down" /><button className="btn btn-ghost btn-sm" disabled={i === total - 1} aria-label="Move down">↓</button></form>
                      <form action={removeStop}><input type="hidden" name="route_id" value={id} /><input type="hidden" name="stop_id" value={s.id} /><button className="btn btn-ghost btn-sm text-bad" aria-label="Remove"><Icon name="x" size={16} /></button></form>
                    </div>
                  )}
                  <Icon name="chevron" size={16} className="text-tt" />
                </div>
              );
            })}
            {editable && (
              <form action={addStopToRoute} className="flex gap-2 p-3 border-t border-line2">
                <input type="hidden" name="route_id" value={id} />
                <select name="business_id" className="input !py-2 !text-[13px]" required defaultValue="">
                  <option value="" disabled>Add a stop…</option>
                  {(candidates ?? []).filter((c) => !inRoute.has(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}{c.city ? ` · ${c.city}` : ""}</option>)}
                </select>
                <button className="btn btn-sm">Add</button>
              </form>
            )}
          </Card>

          {editable && route.status === "in_progress" && (
            <Card title="End the route">
              <form action={endRoute} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
                <input type="hidden" name="route_id" value={id} />
                <label className="field !mb-0"><span>Odometer end</span><input type="number" name="odometer_end" inputMode="decimal" step="0.1" placeholder="miles" /></label>
                <label className="field !mb-0"><span>Or total miles</span><input type="number" name="mileage" inputMode="decimal" step="0.1" placeholder="if no odometer" /></label>
                <button className="btn btn-dark btn-lg"><Icon name="check" size={16} /> Submit route</button>
                <label className="field !mb-0 sm:col-span-3"><span>End-of-day note</span><textarea name="notes" defaultValue={route.notes ?? ""} placeholder="What happened today, what to follow up" /></label>
              </form>
              <details className="mt-3">
                <summary className="text-[12.5px] font-bold text-ts cursor-pointer">Had to stop early? Mark the route interrupted</summary>
                <form action={interruptRoute} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] items-end mt-3">
                  <input type="hidden" name="route_id" value={id} />
                  <label className="field !mb-0"><span>Reason</span>
                    <select name="reason">{["weather", "vehicle_breakdown", "illness", "personal_emergency", "traffic", "materials_ran_out", "reassigned", "safety_concern", "device_or_app_failure", "other"].map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}</select>
                  </label>
                  <label className="field !mb-0"><span>Note</span><input name="note" placeholder="Short explanation" /></label>
                  <button className="btn btn-danger">Interrupt</button>
                </form>
              </details>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Suspense fallback={<div className="card card-body text-ts text-[13px]">Loading weather…</div>}>
            <WeatherCard place={firstCity} lat={route.territory?.center_lat} lng={route.territory?.center_lng} compact={false} />
          </Suspense>
          <Checklist tasks={(tasks ?? []) as RouteTask[]} phase="pre" routeId={id} back={back} title="Before leaving" locked={!canEdit} />
          <Checklist tasks={(tasks ?? []) as RouteTask[]} phase="post" routeId={id} back={back} title="Back at base" locked={!canEdit} />
          <Card title="Expenses" meta={usd(expTotal)} pad={false}>
            {(expenses ?? []).map((e) => (
              <div key={e.id} className="lrow"><span className="flex-1 text-[13px]"><b>{titleCase(e.kind)}</b>{e.note ? <span className="text-tt"> · {e.note}</span> : null}</span><span className="tabular text-[13px] font-bold">{usd(Number(e.amount), 2)}</span></div>
            ))}
            {canEdit && (
              <form action={addExpense} className="grid grid-cols-[1fr_1fr_auto] gap-2 p-3 border-t border-line2">
                <input type="hidden" name="route_id" value={id} />
                <select name="kind" className="input !py-2 !text-[13px]">{["fuel", "parking", "tolls", "meals", "materials", "other"].map((k) => <option key={k} value={k}>{titleCase(k)}</option>)}</select>
                <input name="amount" type="number" step="0.01" min="0" inputMode="decimal" placeholder="$" className="input !py-2 !text-[13px]" required />
                <button className="btn btn-sm">Add</button>
                <input name="note" placeholder="Note (optional)" className="input !py-2 !text-[13px] col-span-3" />
              </form>
            )}
          </Card>
          {Object.keys(route.materials_taken ?? {}).length > 0 && (
            <Card title="Materials taken"><MaterialsTaken taken={route.materials_taken} supabase={supabase} /></Card>
          )}
          {route.notes && <Card title="Notes"><p className="text-[13px] whitespace-pre-wrap">{route.notes}</p></Card>}
        </div>
      </div>
    </div>
  );
}

async function MaterialsTaken({ taken, supabase }: { taken: Record<string, number>; supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>> }) {
  const { data } = await supabase.from("materials").select("id,name").in("id", Object.keys(taken));
  return (
    <ul className="text-[13px] space-y-1">
      {(data ?? []).map((m) => <li key={m.id} className="flex justify-between"><span>{m.name}</span><b className="tabular">{taken[m.id]}</b></li>)}
    </ul>
  );
}
