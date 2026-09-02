import Link from "next/link";
import { Suspense } from "react";
import { requireUser, isManager } from "@/lib/auth";
import { Card, Stat, Pill, Empty, Avatar, statusTone } from "@/components/ui";
import { WeatherCard } from "@/components/weather/WeatherCard";
import { Icon } from "@/components/shell/Icon";
import { fday, fdate, num, todayISO, titleCase } from "@/lib/format";
import { Toast } from "@/components/shell/Toast";
import { addDays, format } from "date-fns";

export const metadata = { title: "Home" };

export default async function Dashboard() {
  const { profile, supabase, role, user } = await requireUser();
  const today = todayISO();
  const monthStart = format(new Date(), "yyyy-MM-01");
  const weekAhead = format(addDays(new Date(), 7), "yyyy-MM-dd");
  const manager = isManager(role);

  const [todayRoutes, monthRoutes, due, lowStock, pendingBiz, pendingContracts, pendingRestock, newLeads, teamToday, people] = await Promise.all([
    supabase.from("v_route_summary").select("*").eq("rep_id", user.id).eq("route_date", today),
    supabase.from("v_route_summary").select("*").eq("rep_id", user.id).gte("route_date", monthStart),
    supabase.from("businesses").select("id,name,city,business_type,next_visit_due,status").eq("assigned_rep_id", user.id).in("status", ["active", "prospect"]).lte("next_visit_due", weekAhead).order("next_visit_due").limit(8),
    supabase.from("materials").select("id,name,qty_on_hand,reorder_point").order("name"),
    manager ? supabase.from("businesses").select("id", { count: "exact", head: true }).eq("eligibility", "pending_review") : Promise.resolve({ count: 0 }),
    manager ? supabase.from("contract_requests").select("id", { count: "exact", head: true }).eq("status", "requested") : Promise.resolve({ count: 0 }),
    manager ? supabase.from("restock_requests").select("id", { count: "exact", head: true }).eq("status", "requested") : Promise.resolve({ count: 0 }),
    manager ? supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "new") : Promise.resolve({ count: 0 }),
    manager ? supabase.from("v_route_summary").select("*").eq("route_date", today).order("started_at", { ascending: false }) : Promise.resolve({ data: [] }),
    manager ? supabase.from("profiles").select("id,full_name,photo_url").eq("is_active", true) : Promise.resolve({ data: [] }),
  ]);

  const tr = todayRoutes.data?.[0];
  const repOf = (id: string) => (people.data ?? []).find((p: { id: string }) => p.id === id) as { full_name: string; photo_url: string | null } | undefined;
  const mr = monthRoutes.data ?? [];
  const stopsDone = mr.reduce((a, r) => a + Number(r.stops_done), 0);
  const miles = mr.reduce((a, r) => a + Number(r.mileage ?? 0), 0);
  const low = (lowStock.data ?? []).filter((m) => m.qty_on_hand <= m.reorder_point);
  const t = profile.territory;
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <Suspense><Toast /></Suspense>
      <div className="pagehead">
        <div>
          <p className="text-[11px] font-bold tracking-[.14em] uppercase text-tt">{fdate(new Date(), "EEEE, MMMM d")}</p>
          <h1>{greet}, {profile.full_name.split(" ")[0]}.</h1>
          <p>{t ? `${t.name} (${t.code}) · ${t.cities.slice(0, 4).join(", ")}` : "No territory assigned yet. Ask a manager."}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/routes/new" className="btn btn-pri"><Icon name="plus" size={16} /> New route</Link>
          <Link href="/businesses/new" className="btn"><Icon name="store" size={16} /> Sign up a business</Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          {/* Today's route */}
          {tr ? (
            <Link href={`/routes/${tr.id}`} className="block card overflow-hidden hover:border-tt">
              <div className="yellow-block rounded-b-none p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold tracking-widest uppercase opacity-70">Today's route</div>
                  <div className="text-[20px] font-extrabold mt-0.5">{Number(tr.stops_done)} of {Number(tr.stops_total)} stops done</div>
                </div>
                <span className="pill bg-black text-brand">{titleCase(tr.status)}</span>
              </div>
              <div className="p-4">
                <div className="bar"><i style={{ width: `${tr.stops_total ? (100 * Number(tr.stops_done)) / Number(tr.stops_total) : 0}%` }} /></div>
                <div className="flex justify-between text-[12px] text-ts mt-2">
                  <span>{tr.started_at ? `Started ${fdate(tr.started_at, "h:mm a")}` : "Not started"}</span>
                  <span className="font-bold text-tp">Open route →</span>
                </div>
              </div>
            </Link>
          ) : (
            <div className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="grid place-items-center w-12 h-12 rounded-2xl bg-brand-tint text-brand-dark flex-none"><Icon name="route" size={24} /></div>
              <div className="flex-1">
                <div className="font-extrabold text-[15px]">No route planned for today</div>
                <div className="text-ts text-[13px] mt-0.5">Build one from your due stops or start a routine route.</div>
              </div>
              <Link href="/routes/new" className="btn btn-dark">Plan today</Link>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat k="Routes this month" v={mr.length} />
            <Stat k="Stops completed" v={stopsDone} />
            <Stat k="Miles driven" v={num(Math.round(miles))} />
            <Stat k="Due this week" v={due.data?.length ?? 0} tone={(due.data?.length ?? 0) > 0 ? "warn" : undefined} />
          </div>

          {/* Due stops */}
          <Card title="Stops due" meta={<Link href="/businesses?filter=due" className="font-bold text-tp">All stops →</Link>} pad={false}>
            {due.data && due.data.length > 0 ? (
              due.data.map((b) => {
                const overdue = b.next_visit_due && b.next_visit_due < today;
                return (
                  <Link key={b.id} href={`/businesses/${b.id}`} className="lrow">
                    <div className={`w-[54px] flex-none text-[11px] font-bold ${overdue ? "text-bad" : "text-ts"}`}>{overdue ? "OVERDUE" : fday(b.next_visit_due)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[13.5px] truncate">{b.name}</div>
                      <div className="text-[11.5px] text-tt truncate">{b.business_type}{b.city ? ` · ${b.city}` : ""}</div>
                    </div>
                    <Pill tone={statusTone(b.status)}>{b.status}</Pill>
                  </Link>
                );
              })
            ) : (
              <div className="p-4"><Empty title="Nothing due in the next 7 days" hint="Stops become due from their visit cadence once you complete a visit." /></div>
            )}
          </Card>

          {/* Manager: team today */}
          {manager && (
            <Card title="Team today" meta={<Link href="/team" className="font-bold text-tp">Team activity →</Link>} pad={false}>
              {teamToday.data && teamToday.data.length > 0 ? (
                teamToday.data.map((r) => (
                  <Link key={r.id} href={`/routes/${r.id}`} className="lrow">
                    <Avatar name={repOf(r.rep_id)?.full_name} src={repOf(r.rep_id)?.photo_url} size={30} />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[13.5px] truncate">{repOf(r.rep_id)?.full_name ?? "Rep"}</div>
                      <div className="text-[11.5px] text-tt">{Number(r.stops_done)}/{Number(r.stops_total)} stops · {r.started_at ? `started ${fdate(r.started_at, "h:mm a")}` : "not started"}</div>
                    </div>
                    <Pill tone={statusTone(r.status)}>{titleCase(r.status)}</Pill>
                  </Link>
                ))
              ) : (
                <div className="p-4"><Empty title="No routes in your territory today" /></div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Suspense fallback={<div className="card card-body text-ts text-[13px]">Loading weather…</div>}>
            <WeatherCard place={t?.cities?.[0] ?? null} lat={t?.center_lat} lng={t?.center_lng} />
          </Suspense>

          {manager && (
            <Card title="Needs a decision" pad={false}>
              {[
                { href: "/businesses?filter=pending", label: "Businesses awaiting approval", n: pendingBiz.count ?? 0 },
                { href: "/contracts", label: "Contract requests to send", n: pendingContracts.count ?? 0 },
                { href: "/inventory?tab=requests", label: "Restock requests", n: pendingRestock.count ?? 0 },
                { href: "/leads", label: "New leads", n: newLeads.count ?? 0 },
              ].map((i) => (
                <Link key={i.href} href={i.href} className="lrow">
                  <span className="flex-1 text-[13px] font-semibold">{i.label}</span>
                  <span className={`pill ${i.n > 0 ? "pill-brand" : "pill-neutral"}`}>{i.n}</span>
                </Link>
              ))}
            </Card>
          )}

          <Card title="Stock" meta={<Link href="/inventory" className="font-bold text-tp">Inventory →</Link>} pad={false}>
            {low.length === 0 ? (
              <div className="p-4 text-[13px] text-ts">All materials above reorder point.</div>
            ) : (
              low.map((m) => (
                <div key={m.id} className="lrow">
                  <span className="flex-1 text-[13px] font-semibold truncate">{m.name}</span>
                  <span className="text-[12px] tabular text-bad font-bold">{num(m.qty_on_hand)} left</span>
                </div>
              ))
            )}
          </Card>

          <Card title="Quick actions" pad={false}>
            <Link href="/routes?tab=templates" className="lrow"><Icon name="route" size={16} className="text-tt" /><span className="flex-1 text-[13px] font-semibold">Start a routine route</span><Icon name="chevron" size={16} className="text-tt" /></Link>
            <Link href="/inventory?tab=request" className="lrow"><Icon name="boxes" size={16} className="text-tt" /><span className="flex-1 text-[13px] font-semibold">Request materials</span><Icon name="chevron" size={16} className="text-tt" /></Link>
            <Link href="/docs" className="lrow"><Icon name="book" size={16} className="text-tt" /><span className="flex-1 text-[13px] font-semibold">Compliance manual</span><Icon name="chevron" size={16} className="text-tt" /></Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
