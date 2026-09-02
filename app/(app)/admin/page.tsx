import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { PageHead, Card, Tabs, Pill, Stat } from "@/components/ui";
import { Toast } from "@/components/shell/Toast";
import { BUSINESS_TYPES, ROLE_LABEL, type UserRole } from "@/lib/types";
import { titleCase, usd, num } from "@/lib/format";
import { saveSettings, saveTerritory, saveChecklist, deleteChecklist, saveDocument, deleteDocument, saveTier } from "./actions";

export const metadata = { title: "Admin" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; doc?: string; checklist?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const tab = sp.tab ?? "users";
  const [{ data: settings }, { data: territories }, { data: managers }, { data: checklists }, { data: docs }, { data: tiers }, { data: pending }, { count: users }, { count: biz }, { count: leads }] = await Promise.all([
    supabase.from("app_settings").select("key,value"),
    supabase.from("territories").select("*").order("code"),
    supabase.from("profiles").select("id,full_name,role").in("role", ["territory_manager", "admin", "super_admin"]).eq("is_active", true).order("full_name"),
    supabase.from("checklist_templates").select("*").order("scope").order("name"),
    supabase.from("documents").select("*").order("category").order("title"),
    supabase.from("rate_card_tiers").select("*").order("sort_order"),
    supabase.from("profiles").select("id,full_name,email,created_at").eq("is_active", false).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("businesses").select("id", { count: "exact", head: true }),
    supabase.from("leads").select("id", { count: "exact", head: true }),
  ]);
  const leadS = (settings?.find((s) => s.key === "leads")?.value ?? {}) as { inbox_email?: string; default_webhook_url?: string; default_tags?: string[]; clickup_list_id?: string };
  const companyS = (settings?.find((s) => s.key === "company")?.value ?? {}) as { name?: string; phone?: string; website?: string; contract_url?: string };
  const editDoc = sp.doc ? (docs ?? []).find((d) => d.id === sp.doc) : null;
  const editCl = sp.checklist ? (checklists ?? []).find((c) => c.id === sp.checklist) : null;
  const tabs = [["users", "Users"], ["settings", "Settings"], ["territories", "Territories"], ["checklists", "Checklists"], ["docs", "Documents"], ["rates", "Rate card"]];

  return (
    <div>
      <Suspense><Toast /></Suspense>
      <PageHead title="Admin" sub="Company-wide setup: people, lead routing, territories, checklists, documents and the rate card." />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4"><Stat k="Active users" v={users ?? 0} /><Stat k="Pending users" v={pending?.length ?? 0} tone={pending?.length ? "warn" : undefined} /><Stat k="Businesses" v={num(biz ?? 0)} /><Stat k="Leads" v={num(leads ?? 0)} /></div>
      <Tabs items={tabs.map(([k, l]) => ({ href: k === "users" ? "/admin" : `/admin?tab=${k}`, label: l }))} active={tab === "users" ? "/admin" : `/admin?tab=${tab}`} />

      {tab === "users" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Pending activation" pad={false}>
            {(pending ?? []).length === 0 ? <div className="p-4 text-[13px] text-ts">Nobody waiting.</div> : (pending ?? []).map((p) => <Link key={p.id} href={`/directory/${p.id}`} className="lrow"><div className="flex-1 min-w-0"><div className="font-bold text-[13.5px]">{p.full_name}</div><div className="text-[12px] text-tt">{p.email}</div></div><span className="btn btn-sm btn-pri">Review</span></Link>)}
          </Card>
          <Card title="How access works">
            <ol className="text-[13px] space-y-2 list-decimal ml-4 text-ts">
              <li>A new person signs in with their email and a one-time code. Their profile is created <b className="text-tp">inactive</b> with the rep role.</li>
              <li>A super admin opens them in the <Link href="/directory?show=pending" className="font-bold text-tp underline">directory</Link>, sets role and territory and ticks Active.</li>
              <li>Roles: {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => ROLE_LABEL[r]).join(", ")}. Reps see their territory; managers see everything in theirs; admins see all.</li>
            </ol>
          </Card>
        </div>
      )}

      {tab === "settings" && (
        <form action={saveSettings} className="grid gap-4 lg:grid-cols-2">
          <Card title="Lead routing">
            <label className="field"><span>Inbox email for leads</span><input name="inbox_email" type="email" defaultValue={leadS.inbox_email ?? ""} placeholder="leads@accidentprofessionals.com" /><span className="hint">Every lead is emailed here unless the store has its own inbox. Also set LEADS_INBOX_EMAIL on Vercel as a fallback.</span></label>
            <label className="field"><span>Default webhook URL (ClickUp automation / Make / Zapier)</span><input name="default_webhook_url" type="url" defaultValue={leadS.default_webhook_url ?? ""} placeholder="https://…" /><span className="hint">Used when a store has no webhook of its own. The JSON includes <code>clickup.name</code>, <code>clickup.description</code> and <code>tags</code>.</span></label>
            <label className="field"><span>Default tags</span><input name="default_tags" defaultValue={(leadS.default_tags ?? []).join(", ")} /></label>
            <label className="field !mb-0"><span>ClickUp list id (optional, passed through)</span><input name="clickup_list_id" defaultValue={leadS.clickup_list_id ?? ""} /></label>
          </Card>
          <Card title="Company & contracts">
            <label className="field"><span>Company name</span><input name="company_name" defaultValue={companyS.name ?? "Accident Professionals"} /></label>
            <label className="field"><span>Phone shown to businesses</span><input name="company_phone" defaultValue={companyS.phone ?? ""} /></label>
            <label className="field"><span>Website</span><input name="company_website" defaultValue={companyS.website ?? ""} /></label>
            <label className="field !mb-0"><span>Agreement link (DocuSign / PandaDoc / PDF)</span><input name="contract_url" type="url" defaultValue={companyS.contract_url ?? ""} /><span className="hint">Included as the sign button in contract emails.</span></label>
            <div className="flex justify-end mt-4"><button className="btn btn-pri">Save settings</button></div>
          </Card>
        </form>
      )}

      {tab === "territories" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
          <Card title="Add territory"><TerritoryForm managers={managers ?? []} /></Card>
          <div className="space-y-3">{(territories ?? []).map((t) => <details key={t.id} className="card"><summary className="px-4 py-3 font-bold text-[13.5px] cursor-pointer flex justify-between"><span>{t.name} <span className="text-tt font-medium">({t.code})</span></span><span className="text-tt font-medium">{t.cities.length} cities · {usd(Number(t.mileage_rate), 2)}/mi</span></summary><div className="p-4 border-t border-line2"><TerritoryForm t={t} managers={managers ?? []} /></div></details>)}</div>
        </div>
      )}

      {tab === "checklists" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <Card title={editCl ? `Edit: ${editCl.name}` : "New checklist"}>
            <form action={saveChecklist} className="space-y-3">
              <input type="hidden" name="id" value={editCl?.id ?? ""} />
              <label className="field !mb-0"><span>Name</span><input name="name" required defaultValue={editCl?.name ?? ""} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="field !mb-0"><span>When</span><select name="scope" defaultValue={editCl?.scope ?? "stop_pre"}><option value="route_pre">Route · before leaving</option><option value="route_post">Route · back at base</option><option value="stop_pre">Stop · arriving</option><option value="stop_post">Stop · leaving</option></select></label>
                <label className="field !mb-0"><span>Territory</span><select name="territory_id" defaultValue={editCl?.territory_id ?? ""}><option value="">All territories</option>{(territories ?? []).map((t) => <option key={t.id} value={t.id}>{t.code}</option>)}</select></label>
                <label className="field !mb-0 col-span-2"><span>Only for business type</span><select name="business_type" defaultValue={editCl?.business_type ?? ""}><option value="">Any type</option>{BUSINESS_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}</select></label>
              </div>
              <label className="field !mb-0"><span>Items, one per line. Start with * to make it required.</span><textarea name="items" className="!min-h-[140px] font-mono !text-[13px]" defaultValue={(editCl?.items ?? []).map((i: { label: string; required?: boolean }) => `${i.required ? "* " : ""}${i.label}`).join("\n")} placeholder={"* Photo of the placement taken\nGreet the owner by name"} /></label>
              <label className="flex items-center gap-2 text-[13px] font-semibold"><input type="checkbox" name="is_active" defaultChecked={editCl ? editCl.is_active : true} className="w-4 h-4 accent-[var(--brand)]" /> Active</label>
              <div className="flex justify-end gap-2">{editCl && <Link href="/admin?tab=checklists" className="btn">New instead</Link>}<button className="btn btn-pri">Save checklist</button></div>
            </form>
          </Card>
          <Card title="Checklists" pad={false}>
            {(checklists ?? []).map((c) => <div key={c.id} className="lrow"><div className="flex-1 min-w-0"><div className="font-bold text-[13.5px]">{c.name}{!c.is_active && <span className="ml-2 pill pill-warn">inactive</span>}</div><div className="text-[12px] text-tt">{titleCase(c.scope)} · {(c.items ?? []).length} items · {c.territory_id ? (territories ?? []).find((t) => t.id === c.territory_id)?.code : "all territories"}{c.business_type ? ` · ${c.business_type}` : ""}</div></div><Link href={`/admin?tab=checklists&checklist=${c.id}`} className="btn btn-sm">Edit</Link><form action={deleteChecklist}><input type="hidden" name="id" value={c.id} /><button className="btn btn-ghost btn-sm text-bad">Delete</button></form></div>)}
          </Card>
        </div>
      )}

      {tab === "docs" && (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Card title={editDoc ? `Edit: ${editDoc.title}` : "New document"}>
            <form action={saveDocument} className="space-y-3">
              <input type="hidden" name="id" value={editDoc?.id ?? ""} />
              <div className="grid sm:grid-cols-2 gap-2">
                <label className="field !mb-0"><span>Title</span><input name="title" required defaultValue={editDoc?.title ?? ""} /></label>
                <label className="field !mb-0"><span>Slug</span><input name="slug" defaultValue={editDoc?.slug ?? ""} placeholder="auto from title" /></label>
                <label className="field !mb-0"><span>Category</span><select name="category" defaultValue={editDoc?.category ?? "training"}>{["compliance", "training", "policy", "brand", "faq"].map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select></label>
                <label className="field !mb-0"><span>Version</span><input name="version" defaultValue={editDoc?.version ?? "1.0"} /><span className="hint">Bump the version to require a fresh acknowledgement.</span></label>
                <label className="field !mb-0 sm:col-span-2"><span>Summary</span><input name="summary" defaultValue={editDoc?.summary ?? ""} /></label>
              </div>
              <label className="field !mb-0"><span>Body (Markdown)</span><textarea name="body_md" className="!min-h-[320px] font-mono !text-[13px]" defaultValue={editDoc?.body_md ?? ""} /></label>
              <div className="flex flex-wrap gap-4 text-[13px] font-semibold">
                <label className="flex items-center gap-2"><input type="checkbox" name="is_published" defaultChecked={editDoc?.is_published ?? false} className="w-4 h-4 accent-[var(--brand)]" /> Published</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="requires_ack" defaultChecked={editDoc?.requires_ack ?? false} className="w-4 h-4 accent-[var(--brand)]" /> Requires acknowledgement</label>
                <span className="text-tt">Audience:</span>{(["rep", "territory_manager", "admin", "super_admin", "business_viewer"] as UserRole[]).map((r) => <label key={r} className="flex items-center gap-1"><input type="checkbox" name="audience" value={r} defaultChecked={editDoc ? (editDoc.audience ?? []).includes(r) : r !== "business_viewer"} /> {ROLE_LABEL[r]}</label>)}
              </div>
              <div className="flex justify-end gap-2">{editDoc && <Link href="/admin?tab=docs" className="btn">New instead</Link>}<button className="btn btn-pri">Save document</button></div>
            </form>
          </Card>
          <Card title="Documents" pad={false}>
            {(docs ?? []).map((d) => <div key={d.id} className="lrow"><div className="flex-1 min-w-0"><div className="font-bold text-[13.5px]"><Link href={`/docs/${d.slug}`} className="hover:underline">{d.title}</Link> <span className="text-tt font-medium text-[11px]">v{d.version}</span></div><div className="text-[12px] text-tt">{titleCase(d.category)}{d.requires_ack ? " · ack required" : ""}</div></div><Pill tone={d.is_published ? "ok" : "warn"}>{d.is_published ? "published" : "draft"}</Pill><Link href={`/admin?tab=docs&doc=${d.id}`} className="btn btn-sm">Edit</Link><form action={deleteDocument}><input type="hidden" name="id" value={d.id} /><button className="btn btn-ghost btn-sm text-bad">Delete</button></form></div>)}
          </Card>
        </div>
      )}

      {tab === "rates" && (
        <Card title="Rate card tiers (audience → monthly fee band)" pad={false}>
          <p className="px-4 pt-3 text-[12.5px] text-ts">Used by the value calculator. Territory bands (Territory → Rate bands) clamp what reps can pre-set; these tiers feed the manager's suggested figure.</p>
          {(tiers ?? []).map((t) => (
            <form key={t.id} action={saveTier} className="lrow flex-wrap gap-2">
              <input type="hidden" name="id" value={t.id} />
              <div className="w-[220px]"><div className="font-bold text-[13.5px]">{t.code} · {t.name}</div><div className="text-[11.5px] text-tt">{titleCase(t.metric)} · {t.exclusivity}</div></div>
              <label className="field !mb-0 w-[110px]"><span>Aud. min</span><input type="number" name="audience_min" defaultValue={t.audience_min} /></label>
              <label className="field !mb-0 w-[110px]"><span>Aud. max</span><input type="number" name="audience_max" defaultValue={t.audience_max ?? ""} /></label>
              <label className="field !mb-0 w-[110px]"><span>Fee min</span><input type="number" name="fee_min" defaultValue={t.fee_min} /></label>
              <label className="field !mb-0 w-[110px]"><span>Fee max</span><input type="number" name="fee_max" defaultValue={t.fee_max} /></label>
              <label className="flex items-center gap-1 text-[12px] font-semibold"><input type="checkbox" name="is_active" defaultChecked={t.is_active} /> Active</label>
              <button className="btn btn-sm">Save</button>
            </form>
          ))}
        </Card>
      )}
    </div>
  );
}

function TerritoryForm({ t, managers }: { t?: { id: string; code: string; name: string; state: string; cities: string[]; manager_id: string | null; mileage_rate: number; center_lat: number | null; center_lng: number | null }; managers: { id: string; full_name: string }[] }) {
  return (
    <form action={saveTerritory} className="grid grid-cols-2 gap-2">
      <input type="hidden" name="id" value={t?.id ?? ""} />
      <label className="field !mb-0"><span>Code</span><input name="code" required defaultValue={t?.code ?? ""} placeholder="GA-NE" /></label>
      <label className="field !mb-0"><span>State</span><input name="state" defaultValue={t?.state ?? "GA"} /></label>
      <label className="field !mb-0 col-span-2"><span>Name</span><input name="name" required defaultValue={t?.name ?? ""} /></label>
      <label className="field !mb-0 col-span-2"><span>Cities (comma separated)</span><input name="cities" defaultValue={(t?.cities ?? []).join(", ")} /></label>
      <label className="field !mb-0"><span>Manager</span><select name="manager_id" defaultValue={t?.manager_id ?? ""}><option value="">—</option>{managers.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></label>
      <label className="field !mb-0"><span>Mileage rate $/mi</span><input type="number" step="0.01" name="mileage_rate" defaultValue={t?.mileage_rate ?? 0.7} /></label>
      <label className="field !mb-0"><span>Centre lat (weather)</span><input name="center_lat" defaultValue={t?.center_lat ?? ""} placeholder="33.94" /></label>
      <label className="field !mb-0"><span>Centre lng</span><input name="center_lng" defaultValue={t?.center_lng ?? ""} placeholder="-84.21" /></label>
      <div className="col-span-2 flex justify-end"><button className="btn btn-pri btn-sm">{t ? "Save" : "Add territory"}</button></div>
    </form>
  );
}
