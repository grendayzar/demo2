import Link from "next/link";
import { Suspense } from "react";
import { requireManager, isAdmin } from "@/lib/auth";
import { PageHead, Card, Stat, Tabs, Pill, Empty, statusTone } from "@/components/ui";
import { Toast } from "@/components/shell/Toast";
import { StopsMap } from "@/components/map/StopsMap";
import { WeatherCard } from "@/components/weather/WeatherCard";
import { usd, num, titleCase, fdate } from "@/lib/format";
import { BUSINESS_TYPES } from "@/lib/types";
import { addTerritoryCost, savePreset, deletePreset } from "./actions";
import { format } from "date-fns";

export const metadata = { title: "Territory" };

export default async function TerritoryPage({ searchParams }: { searchParams: Promise<{ tab?: string; t?: string; period?: string }> }) {
  const { supabase, profile, role } = await requireManager();
  const sp = await searchParams;
  const tab = sp.tab ?? "overview";
  const { data: territories } = await supabase.from("territories").select("*").order("code");
  const tid = (isAdmin(role) && sp.t) || profile.territory_id || territories?.[0]?.id;
  const t = (territories ?? []).find((x) => x.id === tid);
  const period = sp.period ?? format(new Date(), "yyyy-MM");
  const pStart = `${period}-01`;
  const pEnd = format(new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 1), "yyyy-MM-dd");
  const [{ data: biz }, { data: routes }, { data: costs }, { data: presets }, { data: reps }, { data: pricing }, { data: expenses }, { data: materialsUsed }] = await Promise.all([
    supabase.from("businesses").select("id,name,status,eligibility,business_type,city,lat,lng,assigned_rep_id,next_visit_due,last_visit_at").eq("territory_id", tid).neq("status", "archived"),
    supabase.from("v_route_summary").select("*").eq("territory_id", tid).gte("route_date", pStart).lt("route_date", pEnd),
    supabase.from("territory_costs").select("*").eq("territory_id", tid).order("period", { ascending: false }).limit(60),
    supabase.from("territory_rate_presets").select("*").eq("territory_id", tid).order("business_type", { nullsFirst: true }),
    supabase.from("profiles").select("id,full_name,role,photo_url").eq("territory_id", tid).eq("is_active", true).order("full_name"),
    supabase.from("agreement_pricing").select("monthly_fee, agreement:placement_agreements!inner(status,business_id)").eq("agreement.status", "active"),
    supabase.from("route_expenses").select("amount, route:routes!inner(territory_id,route_date)").eq("route.territory_id", tid).gte("route.route_date", pStart).lt("route.route_date", pEnd),
    supabase.from("inventory_movements").select("qty_delta, material:materials(unit_cost)").eq("reason", "placed_at_stop").gte("created_at", `${pStart}T00:00:00Z`).lt("created_at", `${pEnd}T00:00:00Z`),
  ]);
  const bizIds = new Set((biz ?? []).map((b) => b.id));
  const placementFees = (pricing ?? []).filter((p) => bizIds.has((p.agreement as unknown as { business_id: string })?.business_id)).reduce((a, p) => a + Number(p.monthly_fee), 0);
  const active = (biz ?? []).filter((b) => b.status === "active");
  const miles = (routes ?? []).reduce((a, r) => a + Number(r.mileage ?? 0), 0);
  const mileageCost = miles * Number(t?.mileage_rate ?? 0.7);
  const expenseTotal = (expenses ?? []).reduce((a, e) => a + Number(e.amount), 0);
  const materialsCost = (materialsUsed ?? []).reduce((a, m) => a + Math.abs(m.qty_delta) * Number((m.material as unknown as { unit_cost: number | null })?.unit_cost ?? 0), 0);
  const manualCosts = (costs ?? []).filter((c) => c.period === period).reduce((a, c) => a + Number(c.amount), 0);
  const stopsDone = (routes ?? []).reduce((a, r) => a + Number(r.stops_done), 0);
  const overdue = (biz ?? []).filter((b) => b.next_visit_due && b.next_visit_due < new Date().toISOString().slice(0, 10) && ["active", "prospect"].includes(b.status));
  const byStatus = Object.entries((biz ?? []).reduce<Record<string, number>>((a, b) => { a[b.status] = (a[b.status] ?? 0) + 1; return a; }, {}));
  const byType = Object.entries((biz ?? []).reduce<Record<string, number>>((a, b) => { a[b.business_type] = (a[b.business_type] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
  const points = (biz ?? []).filter((b) => b.lat && b.lng).map((b) => ({ id: b.id, lat: Number(b.lat), lng: Number(b.lng), label: b.name, sub: `${b.business_type} · ${b.status}`, href: `/businesses/${b.id}`, done: b.status === "active" }));
  const qs = (extra: string) => `/territory?${isAdmin(role) && tid ? `t=${tid}&` : ""}period=${period}${extra}`;

  return (
    <div>
      <Suspense><Toast /></Suspense>
      <PageHead title={t ? `${t.name} (${t.code})` : "Territory"} sub={t ? `${t.state} · ${t.cities.join(", ")} · mileage ${usd(Number(t.mileage_rate), 2)}/mi` : "No territory"} actions={
        <div className="flex gap-2 flex-wrap">
          {isAdmin(role) && (territories ?? []).length > 1 && <div className="flex gap-1">{(territories ?? []).map((x) => <Link key={x.id} href={`/territory?t=${x.id}&period=${period}${tab !== "overview" ? `&tab=${tab}` : ""}`} className={`chip ${x.id === tid ? "on" : ""}`}>{x.code}</Link>)}</div>}
          <form className="flex gap-1">{isAdmin(role) && tid && <input type="hidden" name="t" value={tid} />}{tab !== "overview" && <input type="hidden" name="tab" value={tab} />}<input type="month" name="period" defaultValue={period} className="input !py-1.5 !text-[12px]" /><button className="btn btn-sm">Go</button></form>
        </div>
      } />
      <Tabs items={[{ href: qs(""), label: "Overview" }, { href: qs("&tab=costs"), label: "Costs" }, { href: qs("&tab=rates"), label: "Rate bands" }, { href: qs("&tab=accounts"), label: "Accounts", count: biz?.length }]} active={qs(tab === "overview" ? "" : `&tab=${tab}`)} />

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <Stat k="Active placements" v={active.length} d={`${biz?.length ?? 0} accounts total`} />
            <Stat k="Overdue visits" v={overdue.length} tone={overdue.length ? "bad" : "ok"} />
            <Stat k={`Routes · ${period}`} v={routes?.length ?? 0} d={`${stopsDone} stops done`} />
            <Stat k="Miles" v={num(Math.round(miles))} d={usd(mileageCost)} />
            <Stat k="Placement fees / mo" v={usd(placementFees)} d="active agreements" />
            <Stat k={`Cost · ${period}`} v={usd(mileageCost + expenseTotal + materialsCost + manualCosts)} d="miles + expenses + materials" />
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              {points.length > 0 ? <StopsMap points={points} height={360} /> : <Card><Empty title="No mapped accounts yet" hint="Reps capture the pin when they edit a business on site." /></Card>}
              <Card title="Accounts by type" pad={false}>
                {byType.slice(0, 10).map(([k, v]) => <div key={k} className="lrow"><span className="flex-1 text-[13px] font-semibold">{k}</span><div className="bar w-[120px]"><i style={{ width: `${(100 * v) / (biz?.length || 1)}%` }} /></div><span className="tabular text-[13px] w-8 text-right">{v}</span></div>)}
              </Card>
            </div>
            <div className="space-y-4">
              <Suspense fallback={null}><WeatherCard place={t?.cities?.[0]} lat={t?.center_lat} lng={t?.center_lng} /></Suspense>
              <Card title="Status" pad={false}>{byStatus.map(([k, v]) => <div key={k} className="lrow"><Pill tone={statusTone(k)}>{k}</Pill><span className="flex-1" /><span className="tabular font-bold">{v}</span></div>)}</Card>
              <Card title="People" pad={false}>{(reps ?? []).map((r) => <Link key={r.id} href={`/directory/${r.id}`} className="lrow"><span className="flex-1 text-[13px] font-semibold">{r.full_name}</span><span className="text-[11.5px] text-tt">{titleCase(r.role)}</span></Link>)}</Card>
              {overdue.length > 0 && <Card title="Overdue" pad={false}>{overdue.slice(0, 8).map((b) => <Link key={b.id} href={`/businesses/${b.id}`} className="lrow"><span className="flex-1 text-[13px] font-semibold truncate">{b.name}</span><span className="text-[11.5px] text-bad font-bold">{b.next_visit_due}</span></Link>)}</Card>}
            </div>
          </div>
        </div>
      )}

      {tab === "costs" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            <Card title={`Measured · ${period}`}>
              <dl className="kv"><dt>Mileage</dt><dd>{num(Math.round(miles))} mi × {usd(Number(t?.mileage_rate ?? 0.7), 2)} = <b>{usd(mileageCost)}</b></dd><dt>Route expenses</dt><dd><b>{usd(expenseTotal)}</b></dd><dt>Materials placed</dt><dd><b>{usd(materialsCost)}</b> at unit cost</dd><dt>Placement fees</dt><dd><b>{usd(placementFees)}</b> per month on active agreements</dd><dt>Manual entries</dt><dd><b>{usd(manualCosts)}</b></dd></dl>
              <div className="border-t border-line mt-3 pt-3 flex justify-between text-[15px]"><b>Territory cost</b><b className="tabular">{usd(mileageCost + expenseTotal + materialsCost + manualCosts + placementFees)}</b></div>
              <p className="hint">Placement fees come from active agreements on file. Contract requests marked signed are listed under each business until an agreement is entered.</p>
            </Card>
            <Card title="Add a cost">
              <form action={addTerritoryCost} className="grid grid-cols-2 gap-2">
                <input type="hidden" name="territory_id" value={tid ?? ""} />
                <label className="field !mb-0"><span>Period</span><input type="month" name="period" defaultValue={period} required /></label>
                <label className="field !mb-0"><span>Category</span><select name="category">{["placement_fees", "materials", "expenses", "mileage", "other"].map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select></label>
                <label className="field !mb-0"><span>Amount ($)</span><input type="number" step="0.01" name="amount" required /></label>
                <label className="field !mb-0"><span>Note</span><input name="note" /></label>
                <div className="col-span-2 flex justify-end"><button className="btn btn-pri btn-sm">Add</button></div>
              </form>
            </Card>
          </div>
          <Card title="Cost entries" pad={false}>
            {(costs ?? []).length === 0 ? <div className="p-4 text-[13px] text-ts">No manual entries yet.</div> : <div className="table-wrap"><table className="table"><thead><tr><th>Period</th><th>Category</th><th>Note</th><th className="num">Amount</th></tr></thead><tbody>{(costs ?? []).map((c) => <tr key={c.id}><td>{c.period}</td><td>{titleCase(c.category)}</td><td className="text-ts">{c.note ?? ""}</td><td className="num font-bold">{usd(Number(c.amount), 2)}</td></tr>)}</tbody></table></div>}
          </Card>
        </div>
      )}

      {tab === "rates" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <Card title="Add or update a band">
            <form action={savePreset} className="grid grid-cols-2 gap-2">
              <input type="hidden" name="territory_id" value={tid ?? ""} />
              <label className="field !mb-0 col-span-2"><span>Business type</span><select name="business_type" defaultValue=""><option value="">Whole territory (default)</option>{BUSINESS_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}</select></label>
              <label className="field !mb-0"><span>Min $/month</span><input type="number" name="monthly_min" defaultValue={200} step={25} /></label>
              <label className="field !mb-0"><span>Max $/month</span><input type="number" name="monthly_max" defaultValue={1000} step={25} /></label>
              <label className="field !mb-0"><span>Suggested</span><input type="number" name="default_fee" defaultValue={350} step={25} /></label>
              <label className="field !mb-0"><span>Notes</span><input name="notes" /></label>
              <div className="col-span-2 flex justify-end"><button className="btn btn-pri btn-sm">Save band</button></div>
            </form>
            <p className="hint mt-2">Reps see the band when signing a business up and can only pre-set a rate inside it.</p>
          </Card>
          <Card title="Current bands" pad={false}>
            {(presets ?? []).map((p) => (
              <div key={p.id} className="lrow"><div className="flex-1"><div className="text-[13.5px] font-bold">{p.business_type ?? "Whole territory"}</div><div className="text-[12px] text-tt">{usd(Number(p.monthly_min))} – {usd(Number(p.monthly_max))}{p.default_fee ? ` · suggested ${usd(Number(p.default_fee))}` : ""}{p.notes ? ` · ${p.notes}` : ""}</div></div>
                <form action={savePreset} className="hidden" />
                <form action={deletePreset}><input type="hidden" name="id" value={p.id} /><button className="btn btn-ghost btn-sm text-bad">Remove</button></form></div>
            ))}
          </Card>
        </div>
      )}

      {tab === "accounts" && (
        <Card pad={false}>
          <div className="table-wrap"><table className="table"><thead><tr><th>Business</th><th>Type</th><th>City</th><th>Rep</th><th>Last visit</th><th>Next due</th><th>Status</th></tr></thead>
            <tbody>{(biz ?? []).sort((a, b) => a.name.localeCompare(b.name)).map((b) => <tr key={b.id}><td><Link href={`/businesses/${b.id}`} className="font-bold hover:underline">{b.name}</Link></td><td className="text-ts">{b.business_type}</td><td className="text-ts">{b.city ?? "—"}</td><td className="text-ts">{(reps ?? []).find((r) => r.id === b.assigned_rep_id)?.full_name ?? "—"}</td><td className="text-ts">{b.last_visit_at ? fdate(b.last_visit_at, "MMM d") : "—"}</td><td>{b.next_visit_due ?? "—"}</td><td><Pill tone={statusTone(b.eligibility === "pending_review" ? "pending_review" : b.status)}>{b.eligibility === "pending_review" ? "pending" : b.status}</Pill></td></tr>)}</tbody></table></div>
        </Card>
      )}
    </div>
  );
}
