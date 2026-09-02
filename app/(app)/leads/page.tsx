import Link from "next/link";
import { Suspense } from "react";
import { requireManager } from "@/lib/auth";
import { PageHead, Card, Pill, Empty, Stat, statusTone } from "@/components/ui";
import { Toast } from "@/components/shell/Toast";
import { fdate } from "@/lib/format";
import { setLeadStatus } from "./actions";

export const metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string; business?: string }> }) {
  const { supabase } = await requireManager();
  const sp = await searchParams;
  let q = supabase.from("leads").select("*, business:businesses(id,name,city), deliveries:lead_deliveries(channel,status,target,response_code)").order("created_at", { ascending: false }).limit(200);
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.business) q = q.eq("business_id", sp.business);
  const [{ data: leads }, { count: newCount }, { count: monthCount }] = await Promise.all([
    q,
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ]);
  const byStore = new Map<string, number>();
  (leads ?? []).forEach((l) => byStore.set(l.business?.name ?? "Unknown", (byStore.get(l.business?.name ?? "Unknown") ?? 0) + 1));
  const top = Array.from(byStore.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div>
      <Suspense><Toast /></Suspense>
      <PageHead title="Leads" sub="Everything that came in through store QR forms. Each store has its own form, tags and webhook, so you can see which placements work." />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat k="New" v={newCount ?? 0} tone={newCount ? "brand" : undefined} />
        <Stat k="This month" v={monthCount ?? 0} />
        <Stat k="Top store" v={top[0]?.[0] ?? "—"} d={top[0] ? `${top[0][1]} in this view` : undefined} />
        <Stat k="Stores with leads" v={byStore.size} />
      </div>
      <div className="flex gap-1.5 flex-wrap mb-4">
        {[["", "All"], ["new", "New"], ["contacted", "Contacted"], ["qualified", "Qualified"], ["closed", "Closed"], ["spam", "Spam"]].map(([s, l]) => <Link key={s} href={`/leads${s ? `?status=${s}` : ""}`} className={`chip ${(sp.status ?? "") === s ? "on" : ""}`}>{l}</Link>)}
      </div>
      <Card pad={false}>
        {!leads || leads.length === 0 ? <div className="p-4"><Empty title="No leads yet" hint="Print a store's QR code from its account page and place it with the material." /></div> : leads.map((l) => (
          <div key={l.id} className="p-4 border-b border-line2 last:border-b-0 flex flex-wrap gap-3 items-start">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap"><span className="font-extrabold text-[15px]">{l.full_name}</span><Pill tone={statusTone(l.status)}>{l.status}</Pill><span className="text-[11.5px] text-tt">{fdate(l.created_at, "MMM d, h:mm a")}</span></div>
              <div className="text-[13px] mt-1">{l.phone && <a href={`tel:${l.phone}`} className="font-bold mr-3">{l.phone}</a>}{l.email && <a href={`mailto:${l.email}`} className="font-semibold text-ts">{l.email}</a>}</div>
              <div className="text-[12.5px] text-ts mt-1">{l.preferred_language === "es" ? "Spanish" : "English"}{l.accident_date ? ` · accident ${l.accident_date}` : ""} · via <Link href={`/businesses/${l.business?.id}`} className="font-semibold text-tp">{l.business?.name ?? "unknown store"}</Link>{l.business?.city ? ` (${l.business.city})` : ""}</div>
              {l.message && <p className="text-[13px] mt-2 border-l-2 border-brand pl-2 whitespace-pre-wrap">{l.message}</p>}
              <div className="flex flex-wrap gap-1 mt-2">{(l.tags ?? []).map((t: string) => <span key={t} className="chip !text-[11px]">{t}</span>)}{(l.deliveries ?? []).map((d: { channel: string; status: string; response_code: number | null }, i: number) => <span key={i} className={`pill ${d.status === "sent" ? "pill-ok" : "pill-bad"}`}>{d.channel} {d.status}{d.response_code ? ` ${d.response_code}` : ""}</span>)}</div>
            </div>
            <form action={setLeadStatus} className="flex gap-1 items-center">
              <input type="hidden" name="id" value={l.id} /><input type="hidden" name="back" value={`/leads${sp.status ? `?status=${sp.status}` : ""}`} />
              <select name="status" defaultValue={l.status} className="input !py-1.5 !text-[12px]">{["new", "contacted", "qualified", "closed", "spam"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
              <button className="btn btn-sm">Update</button>
            </form>
          </div>
        ))}
      </Card>
    </div>
  );
}
