import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser, isAdmin } from "@/lib/auth";
import { Card, Avatar, KV, BackLink, Pill, Stat } from "@/components/ui";
import { Toast } from "@/components/shell/Toast";
import { ROLE_LABEL, type UserRole } from "@/lib/types";
import { fdate, num, titleCase } from "@/lib/format";
import { adminUpdateProfile } from "../../settings/actions";
import { format, subDays } from "date-fns";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, role } = await requireUser();
  const { data: p } = await supabase.from("profiles").select("*, territory:territories(code,name)").eq("id", id).maybeSingle();
  if (!p) notFound();
  const since = format(subDays(new Date(), 30), "yyyy-MM-dd");
  const [{ data: routes }, { data: territories }, { data: acks }, { data: docs }] = await Promise.all([
    supabase.from("v_route_summary").select("*").eq("rep_id", id).gte("route_date", since),
    isAdmin(role) ? supabase.from("territories").select("id,code,name").order("code") : Promise.resolve({ data: [] }),
    supabase.from("document_acks").select("document_id,version,acked_at").eq("profile_id", id),
    supabase.from("documents").select("id,title,version,requires_ack").eq("is_published", true).eq("requires_ack", true),
  ]);
  const stops = (routes ?? []).reduce((a, r) => a + Number(r.stops_done), 0);
  const miles = (routes ?? []).reduce((a, r) => a + Number(r.mileage ?? 0), 0);
  return (
    <div>
      <Suspense><Toast /></Suspense>
      <BackLink href="/directory" label="Directory" />
      <div className="pagehead">
        <div className="flex items-center gap-4">
          <Avatar name={p.full_name} src={p.photo_url} size={64} brand />
          <div><div className="flex items-center gap-2 flex-wrap"><h1>{p.full_name}</h1>{!p.is_active && <Pill tone="warn">pending activation</Pill>}</div><p>{p.job_title ?? ROLE_LABEL[p.role as UserRole]} · {ROLE_LABEL[p.role as UserRole]}{p.territory ? ` · ${p.territory.name} (${p.territory.code})` : ""}</p></div>
        </div>
        <div className="flex gap-2">{p.phone && <a href={`tel:${p.phone}`} className="btn">Call</a>}{p.email && <a href={`mailto:${p.email}`} className="btn">Email</a>}</div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <Card title="Contact"><KV rows={[["Email", p.email], ["Phone", p.phone], ["Language", p.language], ["Vehicle", p.vehicle], ["Emergency contact", p.emergency_contact], ["Started", p.started_on ? fdate(p.started_on, "MMM d, yyyy") : "—"]]} />{p.bio && <p className="text-[13px] mt-3 text-ts">{p.bio}</p>}</Card>
          {["rep", "territory_manager"].includes(p.role) && (
            <>
              <div className="grid grid-cols-3 gap-3"><Stat k="Routes 30d" v={routes?.length ?? 0} /><Stat k="Stops 30d" v={stops} /><Stat k="Miles 30d" v={num(Math.round(miles))} /></div>
              <Card title="Recent routes" pad={false}>{(routes ?? []).slice(0, 8).map((r) => <Link key={r.id} href={`/routes/${r.id}`} className="lrow"><span className="flex-1 text-[13px] font-semibold">{fdate(r.route_date, "EEE, MMM d")}</span><span className="text-[12px] text-tt">{Number(r.stops_done)}/{Number(r.stops_total)} stops</span><Pill tone="neutral">{titleCase(r.status)}</Pill></Link>)}{(routes ?? []).length === 0 && <div className="p-4 text-[13px] text-ts">No routes in the last 30 days.</div>}</Card>
            </>
          )}
          <Card title="Compliance acknowledgements" pad={false}>
            {(docs ?? []).map((d) => { const a = (acks ?? []).find((x) => x.document_id === d.id); return <div key={d.id} className="lrow"><span className="flex-1 text-[13px] font-semibold">{d.title} <span className="text-tt font-medium">v{d.version}</span></span>{a ? <Pill tone={a.version === d.version ? "ok" : "warn"}>{a.version === d.version ? `acknowledged ${fdate(a.acked_at, "MMM d")}` : `old version ${a.version}`}</Pill> : <Pill tone="bad">not acknowledged</Pill>}</div>; })}
            {(docs ?? []).length === 0 && <div className="p-4 text-[13px] text-ts">No documents require acknowledgement.</div>}
          </Card>
        </div>
        {isAdmin(role) && (
          <Card title="Admin">
            <form action={adminUpdateProfile} className="grid sm:grid-cols-2 gap-3">
              <input type="hidden" name="id" value={id} />
              <label className="field !mb-0"><span>Full name</span><input name="full_name" defaultValue={p.full_name} /></label>
              <label className="field !mb-0"><span>Job title</span><input name="job_title" defaultValue={p.job_title ?? ""} /></label>
              <label className="field !mb-0"><span>Role</span><select name="role" defaultValue={p.role}>{(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></label>
              <label className="field !mb-0"><span>Territory</span><select name="territory_id" defaultValue={p.territory_id ?? ""}><option value="">None</option>{(territories ?? []).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}</select></label>
              <label className="field !mb-0"><span>Started on</span><input type="date" name="started_on" defaultValue={p.started_on ?? ""} /></label>
              <label className="field !mb-0"><span>Payee class</span><select name="payee_class" defaultValue={p.payee_class ?? ""}><option value="">—</option>{["contractor_1099", "employee_w2", "vendor", "partner_business"].map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select></label>
              <label className="flex items-center gap-2 text-[13.5px] font-semibold sm:col-span-2"><input type="checkbox" name="is_active" defaultChecked={p.is_active} className="w-4 h-4 accent-[var(--brand)]" /> Active (can sign in and see data)</label>
              <label className="field !mb-0 sm:col-span-2"><span>Internal notes</span><textarea name="notes" defaultValue={p.notes ?? ""} className="!min-h-[60px]" /></label>
              <div className="sm:col-span-2 flex justify-end"><button className="btn btn-pri">Save</button></div>
              <p className="hint sm:col-span-2">Roles and activation require the super admin role; admins can set territory and notes.</p>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
