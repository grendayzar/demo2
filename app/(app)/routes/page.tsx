import Link from "next/link";
import { Suspense } from "react";
import { requireUser, isManager } from "@/lib/auth";
import { PageHead, Card, Pill, Empty, Avatar, statusTone, Tabs } from "@/components/ui";
import { Icon } from "@/components/shell/Icon";
import { Toast } from "@/components/shell/Toast";
import { fday, num, titleCase, todayISO, usd } from "@/lib/format";

export const metadata = { title: "Routes" };

export default async function RoutesPage({ searchParams }: { searchParams: Promise<{ tab?: string; rep?: string }> }) {
  const { supabase, role, user } = await requireUser();
  const { tab = "upcoming", rep } = await searchParams;
  const today = todayISO();
  const manager = isManager(role);

  let q = supabase.from("v_route_summary").select("*").order("route_date", { ascending: tab !== "history" });
  if (tab === "history") q = q.or(`route_date.lt.${today},status.in.(submitted,reviewed)`).limit(60);
  else q = q.gte("route_date", today).not("status", "in", "(submitted,reviewed)");
  if (rep) q = q.eq("rep_id", rep);
  const { data: routes } = await q;
  const { data: people } = await supabase.from("profiles").select("id,full_name,photo_url,role").eq("is_active", true).order("full_name");
  const reps = manager ? (people ?? []).filter((p: { role: string }) => p.role === "rep") : null;
  const repOf = (id: string) => (people ?? []).find((p: { id: string }) => p.id === id) as { full_name: string; photo_url: string | null } | undefined;

  return (
    <div>
      <Suspense><Toast /></Suspense>
      <PageHead title="Routes" sub={manager ? "Every route in your territory. Filter by rep, open one to see stops, photos and costs." : "Plan the day, work the stops, submit at the end."}
        actions={<><Link href="/routes/templates" className="btn"><Icon name="checklist" size={16} /> Routine routes</Link><Link href="/routes/new" className="btn btn-pri"><Icon name="plus" size={16} /> New route</Link></>} />
      <Tabs active={`/routes${tab === "history" ? "?tab=history" : ""}`} items={[{ href: "/routes", label: "Upcoming" }, { href: "/routes?tab=history", label: "History" }]} />
      {manager && reps && reps.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-4">
          <Link href={`/routes${tab === "history" ? "?tab=history" : ""}`} className={`chip ${!rep ? "on" : ""}`}>Everyone</Link>
          {reps.map((r) => <Link key={r.id} href={`/routes?${tab === "history" ? "tab=history&" : ""}rep=${r.id}`} className={`chip ${rep === r.id ? "on" : ""}`}>{r.full_name}</Link>)}
        </div>
      )}
      <Card pad={false}>
        {!routes || routes.length === 0 ? (
          <div className="p-4"><Empty title={tab === "history" ? "No past routes yet" : "No upcoming routes"} hint="Create a route for today or start one from a routine route." action={<Link href="/routes/new" className="btn btn-pri">New route</Link>} /></div>
        ) : (
          routes.map((r) => (
            <Link key={r.id} href={`/routes/${r.id}`} className="lrow">
              <div className="w-[64px] flex-none">
                <div className={`text-[12px] font-extrabold ${r.route_date === today ? "text-brand-dark" : ""}`}>{fday(r.route_date)}</div>
                <div className="text-[10.5px] text-tt">{r.route_date}</div>
              </div>
              {manager && <Avatar name={repOf(r.rep_id)?.full_name} src={repOf(r.rep_id)?.photo_url} size={28} />}
              <div className="min-w-0 flex-1">
                <div className="font-bold text-[13.5px] truncate">{manager ? repOf(r.rep_id)?.full_name ?? "Rep" : `${Number(r.stops_total)} stops`}{r.rep_id === user.id && manager ? " (you)" : ""}</div>
                <div className="text-[11.5px] text-tt">{Number(r.stops_done)}/{Number(r.stops_total)} done{r.mileage ? ` · ${num(Number(r.mileage))} mi` : ""}{Number(r.expenses_total) > 0 ? ` · ${usd(Number(r.expenses_total))} expenses` : ""}{r.interrupted ? " · interrupted" : ""}</div>
              </div>
              <div className="hidden sm:block w-[120px]"><div className="bar"><i style={{ width: `${r.stops_total ? (100 * Number(r.stops_done)) / Number(r.stops_total) : 0}%` }} /></div></div>
              <Pill tone={statusTone(r.status)}>{titleCase(r.status)}</Pill>
            </Link>
          ))
        )}
      </Card>
    </div>
  );
}
