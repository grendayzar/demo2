import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { PageHead, Card, Avatar, Pill, Empty, statusTone } from "@/components/ui";
import { fdate, frel, num, titleCase, usd, one } from "@/lib/format";
import { format, subDays } from "date-fns";

export const metadata = { title: "Team activity" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { supabase } = await requireManager();
  const { days = "30" } = await searchParams;
  const since = format(subDays(new Date(), Number(days)), "yyyy-MM-dd");
  const [{ data: people }, { data: routes }, { data: stops }, { data: signups }, { data: audit }] = await Promise.all([
    supabase.from("profiles").select("id,full_name,role,photo_url,phone,email,vehicle,started_on").eq("is_active", true).in("role", ["rep", "territory_manager"]).order("full_name"),
    supabase.from("v_route_summary").select("*").gte("route_date", since).order("route_date", { ascending: false }),
    supabase.from("stops").select("id,rep_id,completed_at,outcome,route_id, business:businesses(name), photos:stop_photos(id)").gte("completed_at", `${since}T00:00:00Z`).order("completed_at", { ascending: false }).limit(400),
    supabase.from("businesses").select("id,submitted_by,created_at").gte("created_at", `${since}T00:00:00Z`),
    supabase.from("audit_log").select("id,at,actor_id,action,entity_type,entity_id").gte("at", `${since}T00:00:00Z`).order("at", { ascending: false }).limit(40),
  ]);
  const byRep = (people ?? []).map((p) => {
    const r = (routes ?? []).filter((x) => x.rep_id === p.id);
    const s = (stops ?? []).filter((x) => x.rep_id === p.id);
    const good = s.filter((x) => ["materials_placed", "restocked", "verified_only"].includes(x.outcome)).length;
    const withPhoto = s.filter((x) => (x.photos?.length ?? 0) > 0).length;
    return { p, routes: r.length, stops: s.length, good, withPhoto, miles: r.reduce((a, x) => a + Number(x.mileage ?? 0), 0), expenses: r.reduce((a, x) => a + Number(x.expenses_total), 0), signups: (signups ?? []).filter((b) => b.submitted_by === p.id).length, last: s[0]?.completed_at ?? r[0]?.started_at ?? null, active: r.find((x) => x.status === "in_progress") };
  });
  const recent = (stops ?? []).slice(0, 25);

  return (
    <div>
      <PageHead title="Team activity" sub="Where every rep has been and what they're doing right now." actions={<div className="flex gap-1">{["7", "30", "90"].map((d) => <Link key={d} href={`/team?days=${d}`} className={`chip ${days === d ? "on" : ""}`}>{d} days</Link>)}</div>} />
      <Card pad={false} className="mb-4">
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Rep</th><th>Now</th><th className="num">Routes</th><th className="num">Stops</th><th className="num">Success</th><th className="num">Photo rate</th><th className="num">Miles</th><th className="num">Expenses</th><th className="num">Sign-ups</th><th>Last activity</th></tr></thead>
          <tbody>{byRep.map(({ p, ...m }) => (
            <tr key={p.id}>
              <td><Link href={`/directory/${p.id}`} className="flex items-center gap-2 font-bold hover:underline"><Avatar name={p.full_name} src={p.photo_url} size={26} />{p.full_name}<span className="text-tt font-medium text-[11px]">{p.role === "territory_manager" ? "TM" : ""}</span></Link></td>
              <td>{m.active ? <Link href={`/routes/${m.active.id}`}><Pill tone="info">On route · {Number(m.active.stops_done)}/{Number(m.active.stops_total)}</Pill></Link> : <span className="text-tt text-[12px]">idle</span>}</td>
              <td className="num">{m.routes}</td><td className="num">{m.stops}</td>
              <td className={`num ${m.stops && m.good / m.stops < 0.6 ? "text-warn font-bold" : ""}`}>{m.stops ? `${Math.round((100 * m.good) / m.stops)}%` : "—"}</td>
              <td className={`num ${m.stops && m.withPhoto / m.stops < 0.8 ? "text-bad font-bold" : ""}`}>{m.stops ? `${Math.round((100 * m.withPhoto) / m.stops)}%` : "—"}</td>
              <td className="num">{num(Math.round(m.miles))}</td><td className="num">{usd(m.expenses)}</td><td className="num">{m.signups}</td>
              <td className="text-ts">{m.last ? frel(m.last) : "—"}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Latest stop reports" pad={false}>
          {recent.length === 0 ? <div className="p-4"><Empty title="No stop reports in this window" /></div> : recent.map((s) => <Link key={s.id} href={`/routes/${s.route_id}/stops/${s.id}`} className="lrow"><div className="flex-1 min-w-0"><div className="text-[13.5px] font-bold truncate">{one(s.business)?.name}</div><div className="text-[11.5px] text-tt">{(people ?? []).find((p) => p.id === s.rep_id)?.full_name} · {fdate(s.completed_at, "MMM d, h:mm a")}{(s.photos?.length ?? 0) === 0 ? " · no photo" : ""}</div></div><Pill tone={["materials_placed", "restocked", "verified_only"].includes(s.outcome) ? "ok" : "warn"}>{titleCase(s.outcome)}</Pill></Link>)}
        </Card>
        <Card title="Routes" pad={false}>
          {(routes ?? []).slice(0, 25).map((r) => <Link key={r.id} href={`/routes/${r.id}`} className="lrow"><div className="flex-1 min-w-0"><div className="text-[13.5px] font-bold">{(people ?? []).find((p) => p.id === r.rep_id)?.full_name ?? "Rep"} <span className="text-tt font-medium">· {fdate(r.route_date, "EEE, MMM d")}</span></div><div className="text-[11.5px] text-tt">{Number(r.stops_done)}/{Number(r.stops_total)} stops{r.mileage ? ` · ${num(Number(r.mileage))} mi` : ""}{r.interrupted ? " · interrupted" : ""}</div></div><Pill tone={statusTone(r.status)}>{titleCase(r.status)}</Pill></Link>)}
        </Card>
      </div>
      {(audit ?? []).length > 0 && (
        <Card title="Audit trail (money & account changes)" pad={false} className="mt-4">
          {(audit ?? []).map((a) => <div key={a.id} className="lrow text-[12.5px]"><span className="text-tt w-[120px] flex-none">{fdate(a.at, "MMM d, h:mm a")}</span><span className="flex-1">{(people ?? []).find((p) => p.id === a.actor_id)?.full_name ?? "System"} · {a.action.toLowerCase()} {a.entity_type.replace(/_/g, " ")}</span></div>)}
        </Card>
      )}
    </div>
  );
}
