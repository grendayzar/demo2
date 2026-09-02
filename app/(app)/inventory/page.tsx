import Link from "next/link";
import { Suspense } from "react";
import { requireUser, isAdmin, isManager } from "@/lib/auth";
import { PageHead, Card, Pill, Empty, Stat, Tabs, statusTone } from "@/components/ui";
import { Toast } from "@/components/shell/Toast";
import { fdate, num, titleCase, usd } from "@/lib/format";
import { subDays } from "date-fns";
import { requestRestock, cancelRestock, decideRestock, adjustStock, reportDamaged, saveMaterial, saveKit } from "./actions";

export const metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { supabase, role, user } = await requireUser();
  const { tab = "stock" } = await searchParams;
  const admin = isAdmin(role);
  const manager = isManager(role);
  const [{ data: materials }, { data: requests }, { data: ledger }, { data: kits }, { data: reps }, { data: usage }] = await Promise.all([
    supabase.from("materials").select("*").order("kind").order("name"),
    supabase.from("restock_requests").select("*, material:materials(name), rep:profiles!restock_requests_requested_by_fkey(full_name), business:businesses(name)").order("requested_at", { ascending: false }).limit(100),
    tab === "ledger" ? supabase.from("inventory_movements").select("*, material:materials(name), actor:profiles!inventory_movements_actor_id_fkey(full_name), business:businesses(name)").order("created_at", { ascending: false }).limit(150) : Promise.resolve({ data: [] }),
    tab === "kits" ? supabase.from("rep_kits").select("*, rep:profiles!rep_kits_rep_id_fkey(full_name)") : Promise.resolve({ data: [] }),
    manager ? supabase.from("profiles").select("id,full_name").eq("role", "rep").eq("is_active", true).order("full_name") : Promise.resolve({ data: [] }),
    supabase.from("inventory_movements").select("material_id,qty_delta").eq("reason", "placed_at_stop").gte("created_at", subDays(new Date(), 30).toISOString()),
  ]);
  const used30 = new Map<string, number>();
  (usage ?? []).forEach((u: { material_id: string; qty_delta: number }) => used30.set(u.material_id, (used30.get(u.material_id) ?? 0) - u.qty_delta));
  const low = (materials ?? []).filter((m) => m.qty_on_hand <= m.reorder_point);
  const stockValue = (materials ?? []).reduce((a, m) => a + Number(m.unit_cost ?? 0) * m.qty_on_hand, 0);
  const openReq = (requests ?? []).filter((r) => ["requested", "approved", "ordered"].includes(r.status));
  const tabs = [
    { href: "/inventory", label: "Stock" }, { href: "/inventory?tab=request", label: "Request materials" }, { href: "/inventory?tab=requests", label: "Requests", count: openReq.length },
    { href: "/inventory?tab=ledger", label: "Ledger" }, ...(manager ? [{ href: "/inventory?tab=kits", label: "Rep kits" }] : []), ...(admin ? [{ href: "/inventory?tab=materials", label: "Materials" }] : []),
  ];
  const active = tab === "stock" ? "/inventory" : `/inventory?tab=${tab}`;

  return (
    <div>
      <Suspense><Toast /></Suspense>
      <PageHead title="Inventory" sub="Live stock. Reps' stop reports draw it down; the office tops it up. Every change is in the ledger." />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat k="Materials" v={materials?.length ?? 0} />
        <Stat k="Below reorder point" v={low.length} tone={low.length ? "bad" : "ok"} />
        <Stat k="Open requests" v={openReq.length} tone={openReq.length ? "warn" : undefined} />
        <Stat k="Stock value" v={usd(stockValue)} d="at unit cost" />
      </div>
      <Tabs items={tabs} active={active} />

      {tab === "stock" && (
        <Card pad={false}>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Material</th><th>Kind</th><th>Version</th><th className="num">On hand</th><th className="num">Reorder at</th><th className="num">Used 30d</th><th>Level</th></tr></thead>
            <tbody>{(materials ?? []).map((m) => {
              const pct = m.reorder_point ? Math.min(100, Math.round((100 * m.qty_on_hand) / (m.reorder_point * 2))) : 100;
              const lowNow = m.qty_on_hand <= m.reorder_point;
              return (<tr key={m.id}>
                <td className="font-bold">{m.name}</td><td className="text-ts">{titleCase(m.kind)} · {m.language}</td><td className="text-ts">{m.design_version ?? "—"}</td>
                <td className={`num font-bold ${lowNow ? "text-bad" : ""}`}>{num(m.qty_on_hand)}</td><td className="num text-ts">{num(m.reorder_point)}</td><td className="num text-ts">{num(used30.get(m.id) ?? 0)}</td>
                <td><div className="bar w-[90px]"><i style={{ width: `${pct}%`, background: lowNow ? "var(--bad)" : "var(--ok)" }} /></div></td>
              </tr>);
            })}</tbody>
          </table></div>
          {!admin && (
            <details className="p-4 border-t border-line2">
              <summary className="text-[12.5px] font-bold text-ts cursor-pointer">Report damaged or lost items from your kit</summary>
              <form action={reportDamaged} className="grid sm:grid-cols-[1fr_auto_1fr_auto] gap-2 mt-3 items-end">
                <label className="field !mb-0"><span>Material</span><select name="material_id">{(materials ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
                <label className="field !mb-0 w-[110px]"><span>Qty</span><input type="number" name="qty" min={1} inputMode="numeric" required /></label>
                <label className="field !mb-0"><span>Note</span><input name="note" placeholder="what happened" /></label>
                <button className="btn">Record</button>
              </form>
            </details>
          )}
        </Card>
      )}

      {tab === "request" && (
        <Card title="Request materials from the office">
          <form action={requestRestock} className="grid sm:grid-cols-2 gap-3">
            <label className="field !mb-0"><span>Material</span><select name="material_id">{(materials ?? []).map((m) => <option key={m.id} value={m.id}>{m.name} ({num(m.qty_on_hand)} in stock)</option>)}</select></label>
            <label className="field !mb-0"><span>Quantity</span><input type="number" name="quantity" min={1} inputMode="numeric" required placeholder="e.g. 500" /></label>
            <label className="field !mb-0"><span>Urgency</span><select name="urgency"><option value="routine">Routine</option><option value="before_next_route">Before my next route</option><option value="urgent">Urgent</option></select></label>
            <label className="field !mb-0"><span>Notes</span><input name="notes" placeholder="Which stops it's for, pickup preference" /></label>
            <div className="sm:col-span-2 flex justify-end"><button className="btn btn-pri">Send request</button></div>
          </form>
        </Card>
      )}

      {tab === "requests" && (
        <Card pad={false}>
          {!requests || requests.length === 0 ? <div className="p-4"><Empty title="No requests" /></div> : requests.map((r) => (
            <div key={r.id} className="lrow flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-[13.5px]">{num(r.quantity)} × {r.material?.name ?? "Material"}{r.business ? <span className="text-tt font-medium"> · for {r.business.name}</span> : null}</div>
                <div className="text-[11.5px] text-tt">{r.rep?.full_name} · {fdate(r.requested_at, "MMM d")} · {titleCase(r.urgency)}{r.notes ? ` · ${r.notes}` : ""}</div>
              </div>
              <Pill tone={statusTone(r.status)}>{r.status}</Pill>
              {r.requested_by === user.id && r.status === "requested" && <form action={cancelRestock}><input type="hidden" name="id" value={r.id} /><button className="btn btn-ghost btn-sm">Cancel</button></form>}
              {admin && ["requested", "approved", "ordered"].includes(r.status) && (
                <div className="flex gap-1">
                  {r.status === "requested" && <form action={decideRestock}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="approved" /><button className="btn btn-sm">Approve</button></form>}
                  {r.status !== "ordered" && <form action={decideRestock}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="ordered" /><button className="btn btn-sm">Ordered</button></form>}
                  <form action={decideRestock}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="fulfilled" /><button className="btn btn-pri btn-sm">Fulfilled</button></form>
                  <form action={decideRestock}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="cancelled" /><button className="btn btn-ghost btn-sm text-bad">Reject</button></form>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      {tab === "ledger" && (
        <div className="space-y-4">
          {admin && (
            <Card title="Office top-up / adjustment">
              <form action={adjustStock} className="grid sm:grid-cols-[1fr_auto_auto_1fr_auto] gap-2 items-end">
                <label className="field !mb-0"><span>Material</span><select name="material_id">{(materials ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
                <label className="field !mb-0"><span>Reason</span><select name="reason"><option value="restock">Restock (add)</option><option value="adjustment">Adjustment (+/−)</option><option value="count">Physical count (set to)</option><option value="damaged">Damaged (remove)</option><option value="kit_issue">Issued to rep (remove)</option></select></label>
                <label className="field !mb-0 w-[110px]"><span>Qty</span><input type="number" name="qty" inputMode="numeric" required /></label>
                <label className="field !mb-0"><span>Note</span><input name="note" placeholder="PO number, supplier, who" /></label>
                <button className="btn btn-pri">Apply</button>
              </form>
            </Card>
          )}
          <Card pad={false}>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>When</th><th>Material</th><th className="num">Change</th><th>Reason</th><th>By</th><th>Where / note</th></tr></thead>
              <tbody>{(ledger ?? []).length === 0 ? <tr><td colSpan={6} className="text-ts">No movements yet.</td></tr> : (ledger ?? []).map((l) => (
                <tr key={l.id}><td className="text-ts whitespace-nowrap">{fdate(l.created_at, "MMM d, h:mm a")}</td><td className="font-bold">{l.material?.name}</td>
                  <td className={`num font-bold ${l.qty_delta < 0 ? "text-bad" : "text-ok"}`}>{l.qty_delta > 0 ? "+" : ""}{num(l.qty_delta)}</td><td>{titleCase(l.reason)}</td><td className="text-ts">{l.actor?.full_name}</td>
                  <td className="text-ts">{l.business?.name ? <Link href={`/businesses/${l.business_id}`} className="font-semibold">{l.business.name}</Link> : null}{l.note ? ` ${l.note}` : ""}</td></tr>
              ))}</tbody>
            </table></div>
          </Card>
        </div>
      )}

      {tab === "kits" && manager && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Issue or reconcile a rep kit">
            <form action={saveKit} className="space-y-3">
              <label className="field !mb-0"><span>Rep</span><select name="rep_id">{(reps ?? []).map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}</select></label>
              <div className="grid grid-cols-2 gap-2">{(materials ?? []).map((m) => <label key={m.id} className="field !mb-0"><span className="truncate">{m.name}</span><input type="number" name={`mat_${m.id}`} min={0} inputMode="numeric" placeholder="0" /></label>)}</div>
              <label className="field !mb-0"><span>Note</span><input name="note" /></label>
              <button className="btn btn-pri">Save kit</button>
            </form>
          </Card>
          <Card title="Current kits" pad={false}>
            {(kits ?? []).length === 0 ? <div className="p-4 text-ts text-[13px]">No kits recorded.</div> : (kits ?? []).map((k) => (
              <div key={k.id} className="lrow"><div className="flex-1"><div className="font-bold text-[13.5px]">{k.rep?.full_name}</div><div className="text-[11.5px] text-tt">{Object.entries(k.contents ?? {}).map(([id, q]) => `${(materials ?? []).find((m) => m.id === id)?.name ?? id} × ${q}`).join(", ") || "empty"} · {fdate(k.issued_at, "MMM d")}</div></div></div>
            ))}
          </Card>
        </div>
      )}

      {tab === "materials" && admin && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <Card title="Add a material">
            <MaterialForm />
          </Card>
          <div className="space-y-3">
            {(materials ?? []).map((m) => (
              <details key={m.id} className="card">
                <summary className="px-4 py-3 font-bold text-[13.5px] cursor-pointer flex justify-between">{m.name}<span className="text-tt font-medium">{num(m.qty_on_hand)} on hand</span></summary>
                <div className="p-4 border-t border-line2"><MaterialForm m={m} /></div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MaterialForm({ m }: { m?: { id: string; name: string; kind: string; language: string; design_version: string | null; reorder_point: number; unit_cost: number | null; supplier: string | null; artwork_url: string | null } }) {
  return (
    <form action={saveMaterial} className="grid sm:grid-cols-2 gap-3">
      <input type="hidden" name="id" value={m?.id ?? ""} />
      <label className="field !mb-0 sm:col-span-2"><span>Name</span><input name="name" required defaultValue={m?.name ?? ""} /></label>
      <label className="field !mb-0"><span>Kind</span><select name="kind" defaultValue={m?.kind ?? "flyer"}>{["cards", "flyer", "poster", "decal", "display", "aframe", "brochure", "sticker", "merch", "other"].map((k) => <option key={k} value={k}>{titleCase(k)}</option>)}</select></label>
      <label className="field !mb-0"><span>Language</span><select name="language" defaultValue={m?.language ?? "both"}><option value="es">Spanish</option><option value="en">English</option><option value="both">Bilingual</option></select></label>
      <label className="field !mb-0"><span>Design version</span><input name="design_version" defaultValue={m?.design_version ?? ""} /></label>
      <label className="field !mb-0"><span>Reorder point</span><input type="number" name="reorder_point" min={0} defaultValue={m?.reorder_point ?? 0} /></label>
      {!m && <label className="field !mb-0"><span>Opening stock</span><input type="number" name="qty_on_hand" min={0} defaultValue={0} /></label>}
      <label className="field !mb-0"><span>Unit cost ($)</span><input type="number" step="0.01" name="unit_cost" defaultValue={m?.unit_cost ?? ""} /></label>
      <label className="field !mb-0"><span>Supplier</span><input name="supplier" defaultValue={m?.supplier ?? ""} /></label>
      <label className="field !mb-0 sm:col-span-2"><span>Artwork URL</span><input name="artwork_url" defaultValue={m?.artwork_url ?? ""} /></label>
      <div className="sm:col-span-2 flex justify-end"><button className="btn btn-pri btn-sm">{m ? "Save" : "Add material"}</button></div>
    </form>
  );
}
