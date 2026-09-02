import Link from "next/link";
import { Suspense } from "react";
import { requireUser, isManager } from "@/lib/auth";
import { PageHead, Card, Pill, Empty, statusTone } from "@/components/ui";
import { Toast } from "@/components/shell/Toast";
import { Icon } from "@/components/shell/Icon";
import { fday, todayISO, one } from "@/lib/format";
import { BUSINESS_TYPES } from "@/lib/types";

export const metadata = { title: "Stops" };

export default async function BusinessesPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; type?: string; status?: string }> }) {
  const { supabase, user, role } = await requireUser();
  const sp = await searchParams;
  const filter = sp.filter ?? "mine";
  const today = todayISO();
  let q = supabase.from("businesses").select("id,name,business_type,city,status,eligibility,next_visit_due,last_visit_at,assigned_rep_id,needs_detail, rep:profiles!businesses_assigned_rep_id_fkey(full_name)").order("name").limit(300);
  if (filter === "mine") q = q.eq("assigned_rep_id", user.id).not("status", "in", "(archived,ineligible,declined)");
  if (filter === "due") q = q.lte("next_visit_due", today).in("status", ["active", "prospect"]);
  if (filter === "pending") q = q.eq("eligibility", "pending_review");
  if (filter === "all") q = q.not("status", "in", "(archived)");
  const term = (sp.q ?? "").replace(/[,()%]/g, " ").trim();
  if (term) q = q.or(`name.ilike.%${term}%,city.ilike.%${term}%,address.ilike.%${term}%,business_type.ilike.%${term}%`);
  if (sp.type) q = q.eq("business_type", sp.type);
  if (sp.status) q = q.eq("status", sp.status);
  const { data: rows } = await q;
  const manager = isManager(role);
  const mk = (f: string) => `/businesses?filter=${f}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}${sp.type ? `&type=${encodeURIComponent(sp.type)}` : ""}`;

  return (
    <div>
      <Suspense><Toast /></Suspense>
      <PageHead title="Stop accounts" sub="Every business where we place material. Search, filter, open one for history, QR code and contract." actions={<Link href="/businesses/new" className="btn btn-pri"><Icon name="plus" size={16} /> Sign up a business</Link>} />
      <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto] mb-3">
        <input type="hidden" name="filter" value={filter} />
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Search name, city, address…" className="input" />
        <select name="type" defaultValue={sp.type ?? ""} className="input"><option value="">All types</option>{BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        <button className="btn"><Icon name="search" size={16} /> Search</button>
      </form>
      <div className="flex gap-1.5 flex-wrap mb-4">
        {[["mine", "My stops"], ["due", "Due now"], ["all", "Territory"], ...(manager ? [["pending", "Awaiting approval"]] : [])].map(([f, l]) => <Link key={f} href={mk(f)} className={`chip ${filter === f ? "on" : ""}`}>{l}</Link>)}
      </div>
      <Card pad={false}>
        {!rows || rows.length === 0 ? (
          <div className="p-4"><Empty title="No businesses match" hint={filter === "mine" ? "Nothing is assigned to you yet. Browse the territory or sign a new business up." : "Try another filter or search."} action={<Link href="/businesses/new" className="btn btn-pri">Sign up a business</Link>} /></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Business</th><th>Type</th><th>City</th><th>Next due</th>{filter !== "mine" && <th>Rep</th>}<th>Status</th></tr></thead>
              <tbody>
                {rows.map((b) => {
                  const overdue = b.next_visit_due && b.next_visit_due < today;
                  return (
                    <tr key={b.id}>
                      <td><Link href={`/businesses/${b.id}`} className="font-bold hover:underline">{b.name}</Link>{b.needs_detail && <span className="ml-2 pill pill-warn">needs details</span>}</td>
                      <td className="text-ts">{b.business_type}</td>
                      <td className="text-ts">{b.city ?? "—"}</td>
                      <td className={overdue ? "text-bad font-bold" : ""}>{b.next_visit_due ? fday(b.next_visit_due) : "—"}</td>
                      {filter !== "mine" && <td className="text-ts">{one(b.rep)?.full_name ?? "Unassigned"}</td>}
                      <td><Pill tone={statusTone(b.eligibility === "pending_review" ? "pending_review" : b.status)}>{b.eligibility === "pending_review" ? "pending approval" : b.status}</Pill></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
