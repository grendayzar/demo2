import Link from "next/link";
import { Suspense } from "react";
import { requireUser, isAdmin } from "@/lib/auth";
import { PageHead, Card, Avatar, Pill, Empty } from "@/components/ui";
import { Toast } from "@/components/shell/Toast";
import { Icon } from "@/components/shell/Icon";
import { ROLE_LABEL, type UserRole } from "@/lib/types";
import { one } from "@/lib/format";

export const metadata = { title: "Directory" };

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<{ q?: string; show?: string }> }) {
  const { supabase, role } = await requireUser();
  const sp = await searchParams;
  let q = supabase.from("profiles").select("id,full_name,role,email,phone,photo_url,job_title,is_active, territory:territories(code,name)").order("full_name");
  if (sp.show === "pending") q = q.eq("is_active", false); else if (sp.show !== "all") q = q.eq("is_active", true);
  const term = (sp.q ?? "").replace(/[,()%]/g, " ").trim();
  if (term) q = q.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,job_title.ilike.%${term}%`);
  const { data: people } = await q;
  const { count: pending } = isAdmin(role) ? await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", false) : { count: 0 };
  const groups = ["super_admin", "admin", "territory_manager", "rep", "business_viewer"] as UserRole[];
  return (
    <div>
      <Suspense><Toast /></Suspense>
      <PageHead title="User directory" sub="Everyone on the team. Managers see their territory; admins see all." />
      <form className="flex gap-2 mb-3"><input name="q" defaultValue={sp.q ?? ""} placeholder="Search name, email, title…" className="input" />{sp.show && <input type="hidden" name="show" value={sp.show} />}<button className="btn"><Icon name="search" size={16} /></button></form>
      {isAdmin(role) && <div className="flex gap-1.5 mb-4"><Link href="/directory" className={`chip ${!sp.show ? "on" : ""}`}>Active</Link><Link href="/directory?show=pending" className={`chip ${sp.show === "pending" ? "on" : ""}`}>Pending activation{pending ? ` (${pending})` : ""}</Link><Link href="/directory?show=all" className={`chip ${sp.show === "all" ? "on" : ""}`}>All</Link></div>}
      {!people || people.length === 0 ? <Empty title="Nobody here" /> : groups.map((g) => {
        const rows = people.filter((p) => p.role === g);
        if (rows.length === 0) return null;
        return (
          <div key={g} className="mb-5">
            <div className="seclabel">{ROLE_LABEL[g]}s</div>
            <div className="grid-auto">
              {rows.map((p) => (
                <Link key={p.id} href={`/directory/${p.id}`} className="card p-4 flex items-center gap-3 hover:border-tt">
                  <Avatar name={p.full_name} src={p.photo_url} size={44} brand />
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-[14px] truncate">{p.full_name}{!p.is_active && <span className="ml-2 pill pill-warn">pending</span>}</div>
                    <div className="text-[12px] text-ts truncate">{p.job_title ?? ROLE_LABEL[p.role as UserRole]}{one(p.territory) ? ` · ${one(p.territory)!.code}` : ""}</div>
                    <div className="text-[11.5px] text-tt truncate">{p.email}{p.phone ? ` · ${p.phone}` : ""}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
      {(() => { void Pill; return null; })()}
    </div>
  );
}
