import { Suspense } from "react";
import { requireUser, isManager } from "@/lib/auth";
import { PageHead, Card, BackLink } from "@/components/ui";
import { RouteBuilder } from "@/components/routes/RouteBuilder";
import { Toast } from "@/components/shell/Toast";
import { createRoute } from "../actions";
import { todayISO } from "@/lib/format";
import Link from "next/link";

export const metadata = { title: "New route" };

export default async function NewRoutePage({ searchParams }: { searchParams: Promise<{ template?: string; date?: string; business?: string }> }) {
  const { supabase, role, user } = await requireUser();
  const sp = await searchParams;
  const today = todayISO();
  const [{ data: businesses }, { data: materials }, { data: reps }, { data: templates }] = await Promise.all([
    supabase.from("businesses").select("id,name,business_type,city,address,next_visit_due,status,assigned_rep_id,lat,lng").in("status", ["active", "prospect", "paused"]).order("name").limit(600),
    supabase.from("materials").select("id,name,qty_on_hand").order("name"),
    isManager(role) ? supabase.from("profiles").select("id,full_name").in("role", ["rep", "territory_manager"]).eq("is_active", true).order("full_name") : Promise.resolve({ data: null }),
    supabase.from("route_templates").select("id,name, stops:route_template_stops(business_id,seq)").eq("is_active", true).order("name"),
  ]);
  let initial: string[] = [];
  if (sp.template) {
    const t = (templates ?? []).find((x) => x.id === sp.template);
    initial = [...(t?.stops ?? [])].sort((a, b) => a.seq - b.seq).map((s) => s.business_id);
  } else if (sp.business) initial = [sp.business];

  return (
    <div>
      <Suspense><Toast /></Suspense>
      <BackLink href="/routes" label="Routes" />
      <PageHead title="Plan a route" sub="Choose the day, add stops in driving order, note what you're taking." />
      <form action={createRoute} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="field">
            <span>Date</span>
            <input type="date" name="route_date" defaultValue={sp.date ?? today} min={today} required />
          </label>
          {reps && (
            <label className="field">
              <span>Rep</span>
              <select name="rep_id" defaultValue={user.id}>{reps.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}</select>
            </label>
          )}
          <label className="field">
            <span>Start from a routine route</span>
            <div className="flex flex-wrap gap-1.5">
              {(templates ?? []).length === 0 && <span className="text-[12.5px] text-tt">None yet. <Link href="/routes/templates/new" className="font-bold text-tp">Create one</Link>.</span>}
              {(templates ?? []).map((t) => <Link key={t.id} href={`/routes/new?template=${t.id}`} className={`chip ${sp.template === t.id ? "on" : ""}`}>{t.name}</Link>)}
            </div>
          </label>
        </div>
        <RouteBuilder key={sp.template ?? "blank"} businesses={businesses ?? []} myId={user.id} initial={initial} today={today} />
        <Card title="Materials taken">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(materials ?? []).map((m) => (
              <label key={m.id} className="field !mb-0">
                <span className="truncate">{m.name}</span>
                <input type="number" name={`mat_${m.id}`} min={0} placeholder="0" inputMode="numeric" />
              </label>
            ))}
          </div>
          <label className="field mt-4"><span>Notes</span><textarea name="notes" placeholder="Anything the manager should know about this plan" /></label>
        </Card>
        <div className="flex justify-end gap-2">
          <Link href="/routes" className="btn">Cancel</Link>
          <button className="btn btn-pri btn-lg">Create route</button>
        </div>
      </form>
    </div>
  );
}
