import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser, isManager } from "@/lib/auth";
import { PageHead, Card, BackLink } from "@/components/ui";
import { RouteBuilder } from "@/components/routes/RouteBuilder";
import { Toast } from "@/components/shell/Toast";
import { saveTemplate, deleteTemplate } from "../../actions";
import { todayISO } from "@/lib/format";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, role } = await requireUser();
  const isNew = id === "new";
  const t = isNew ? null : (await supabase.from("route_templates").select("*, stops:route_template_stops(business_id,seq)").eq("id", id).maybeSingle()).data;
  if (!isNew && !t) notFound();
  const [{ data: businesses }, { data: reps }] = await Promise.all([
    supabase.from("businesses").select("id,name,business_type,city,address,next_visit_due,status,assigned_rep_id,lat,lng").in("status", ["active", "prospect", "paused"]).order("name").limit(600),
    isManager(role) ? supabase.from("profiles").select("id,full_name").in("role", ["rep", "territory_manager"]).eq("is_active", true).order("full_name") : Promise.resolve({ data: null }),
  ]);
  const initial = [...(t?.stops ?? [])].sort((a: { seq: number }, b: { seq: number }) => a.seq - b.seq).map((s: { business_id: string }) => s.business_id);
  return (
    <div>
      <Suspense><Toast /></Suspense>
      <BackLink href="/routes/templates" label="Routine routes" />
      <PageHead title={isNew ? "New routine route" : t!.name} sub="A reusable stop list. Order it the way you drive it." />
      <form action={saveTemplate} className="space-y-4">
        <input type="hidden" name="template_id" value={isNew ? "" : id} />
        <Card>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="field !mb-0 sm:col-span-2"><span>Name</span><input name="name" required defaultValue={t?.name ?? ""} placeholder="e.g. Buford Hwy Tuesdays" /></label>
            <label className="field !mb-0"><span>Usual day</span>
              <select name="weekday" defaultValue={t?.weekday ?? ""}><option value="">Any day</option>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
            </label>
            <label className="field !mb-0"><span>Cadence</span>
              <select name="cadence" defaultValue={t?.cadence ?? "weekly"}>{["weekly", "biweekly", "monthly", "adhoc"].map((c) => <option key={c} value={c}>{c}</option>)}</select>
            </label>
            {reps && (
              <>
                <label className="field !mb-0"><span>Rep</span><select name="rep_id" defaultValue={t?.rep_id ?? user.id}>{reps.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}</select></label>
                <label className="flex items-center gap-2 text-[13px] font-semibold sm:col-span-3 self-end pb-2"><input type="checkbox" name="shared" defaultChecked={t ? t.rep_id == null : false} className="w-4 h-4 accent-[var(--brand)]" /> Shared with every rep in the territory</label>
              </>
            )}
            <label className="field !mb-0 sm:col-span-4"><span>Notes</span><input name="notes" defaultValue={t?.notes ?? ""} placeholder="Parking tips, best times, who to ask for" /></label>
          </div>
        </Card>
        <RouteBuilder businesses={businesses ?? []} myId={user.id} initial={initial} today={todayISO()} />
        <div className="flex justify-between gap-2">
          {!isNew ? <button formAction={deleteTemplate} className="btn btn-danger">Delete</button> : <span />}
          <div className="flex gap-2"><Link href="/routes/templates" className="btn">Cancel</Link><button className="btn btn-pri btn-lg">Save routine route</button></div>
        </div>
      </form>
    </div>
  );
}
