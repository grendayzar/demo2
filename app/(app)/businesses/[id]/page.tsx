import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser, isManager } from "@/lib/auth";
import { Card, Pill, BackLink, KV, Tabs, Empty, Stat, statusTone } from "@/components/ui";
import { Toast } from "@/components/shell/Toast";
import { Icon } from "@/components/shell/Icon";
import { StopsMap } from "@/components/map/StopsMap";
import { ValueCalculator } from "@/components/business/ValueCalculator";
import { GeoFields } from "@/components/routes/GeoButton";
import { fdate, fday, titleCase, usd, num, one } from "@/lib/format";
import { BUSINESS_TYPES, PLACEMENT_TYPES, type RateCardTier, type RatePreset } from "@/lib/types";
import { updateBusiness, decideBusiness, addContact, saveLeadForm, saveAssessment, requestContract } from "../actions";
import { setContractStatus } from "../../contracts/actions";

export default async function BusinessPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  const { supabase, role, user } = await requireUser();
  const manager = isManager(role);
  const { data: b } = await supabase.from("businesses").select("*, rep:profiles!businesses_assigned_rep_id_fkey(id,full_name), territory:territories(code,name)").eq("id", id).maybeSingle();
  if (!b) notFound();
  const [{ data: contacts }, { data: visits }, { data: leadForm }, { data: contracts }, { data: assessments }, { data: tiers }, { data: presets }, { data: reps }, { count: leadCount }, { data: pricing }] = await Promise.all([
    supabase.from("business_contacts").select("*").eq("business_id", id).order("is_primary", { ascending: false }),
    supabase.from("stops").select("id,route_id,seq,completed_at,arrived_at,outcome,poc_spoken_to,notes,materials_left,placement_verified, rep:profiles!stops_rep_id_fkey(full_name), photos:stop_photos(id)").eq("business_id", id).order("created_at", { ascending: false }).limit(30),
    supabase.from("lead_forms").select("*").eq("business_id", id).maybeSingle(),
    supabase.from("contract_requests").select("*, rep:profiles!contract_requests_requested_by_fkey(full_name)").eq("business_id", id).order("created_at", { ascending: false }),
    manager ? supabase.from("business_assessments").select("*, by:profiles!business_assessments_assessed_by_fkey(full_name)").eq("business_id", id).order("created_at", { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    supabase.from("rate_card_tiers").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("territory_rate_presets").select("*").eq("territory_id", b.territory_id ?? "00000000-0000-0000-0000-000000000000"),
    manager ? supabase.from("profiles").select("id,full_name").in("role", ["rep", "territory_manager"]).eq("is_active", true).order("full_name") : Promise.resolve({ data: null }),
    manager ? supabase.from("leads").select("id", { count: "exact", head: true }).eq("business_id", id) : Promise.resolve({ count: null }),
    manager ? supabase.from("placement_agreements").select("id,status,term_start,term_end, pricing:agreement_pricing(monthly_fee)").eq("business_id", id).order("created_at", { ascending: false }).limit(3) : Promise.resolve({ data: [] }),
  ]);
  const preset = ((presets ?? []).find((p) => p.business_type === b.business_type) ?? (presets ?? []).find((p) => p.business_type == null) ?? null) as RatePreset | null;
  const canEdit = manager || b.assigned_rep_id === user.id;
  const base = `/businesses/${id}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const completed = (visits ?? []).filter((v) => v.completed_at);
  const latestAssessment = assessments?.[0];
  const activeContract = (contracts ?? []).find((c) => c.status === "signed") ?? (contracts ?? []).find((c) => ["requested", "sent"].includes(c.status));
  const tabs = [
    { href: base, label: "Overview" }, { href: `${base}?tab=history`, label: "Visits", count: completed.length }, { href: `${base}?tab=leads`, label: "QR & leads" },
    { href: `${base}?tab=contracts`, label: "Contract", count: (contracts ?? []).length || undefined }, ...(manager ? [{ href: `${base}?tab=value`, label: "Value" }] : []), ...(canEdit ? [{ href: `${base}?tab=edit`, label: "Edit" }] : []),
  ];

  return (
    <div>
      <Suspense><Toast /></Suspense>
      <BackLink href="/businesses" label="Stops" />
      <div className="pagehead">
        <div>
          <div className="flex items-center gap-2 flex-wrap"><h1>{b.name}</h1><Pill tone={statusTone(b.eligibility === "pending_review" ? "pending_review" : b.status)}>{b.eligibility === "pending_review" ? "pending approval" : b.status}</Pill>{b.needs_detail && <Pill tone="warn">needs details</Pill>}</div>
          <p>{b.business_type} · {b.address ? `${b.address}, ` : ""}{b.city ?? "city unknown"} · {b.territory?.name ?? "no territory"} · {b.rep ? `Rep ${b.rep.full_name}` : "unassigned"}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(b.address || b.lat) && <a className="btn" target="_blank" rel="noreferrer" href={b.address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${b.address}${b.city ? ", " + b.city : ""}`)}` : `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`}><Icon name="navigate" size={16} /> Navigate</a>}
          {b.phone && <a href={`tel:${b.phone}`} className="btn"><Icon name="phone" size={16} /> Call</a>}
          <Link href={`/routes/new?business=${id}`} className="btn btn-pri"><Icon name="route" size={16} /> Plan a visit</Link>
        </div>
      </div>

      {manager && b.eligibility === "pending_review" && (
        <div className="card p-4 mb-4 flex flex-wrap items-center gap-3 border-brand">
          <div className="flex-1"><b>Awaiting your approval.</b> <span className="text-ts text-[13px]">Submitted by {b.rep?.full_name ?? "a rep"} on {fdate(b.submitted_at, "MMM d")}. Approve to make it an eligible stop.</span></div>
          <form action={decideBusiness} className="flex gap-2"><input type="hidden" name="id" value={id} /><input type="hidden" name="decision" value="approve" /><button className="btn btn-pri btn-sm"><Icon name="check" size={14} /> Approve</button></form>
          <form action={decideBusiness} className="flex gap-2"><input type="hidden" name="id" value={id} /><input type="hidden" name="decision" value="reject" /><input name="reason" placeholder="reason" className="input !py-1.5 !text-[12px] w-[160px]" /><button className="btn btn-danger btn-sm">Not eligible</button></form>
        </div>
      )}

      <Tabs items={tabs} active={tab === "overview" ? base : `${base}?tab=${tab}`} />

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat k="Visits" v={completed.length} d={b.last_visit_at ? `last ${fdate(b.last_visit_at, "MMM d")}` : "none yet"} />
              <Stat k="Next due" v={b.next_visit_due ? fday(b.next_visit_due) : "—"} tone={b.next_visit_due && b.next_visit_due < new Date().toISOString().slice(0, 10) ? "bad" : undefined} d={titleCase(b.cadence)} />
              <Stat k="Monthly rate" v={activeContract ? usd(Number(activeContract.agreed_monthly_fee)) : pricing?.[0]?.pricing?.[0]?.monthly_fee ? usd(Number(pricing[0].pricing[0].monthly_fee)) : "—"} d={activeContract ? `contract ${activeContract.status}` : "no contract yet"} />
              <Stat k={manager ? "Leads" : "Footfall / wk"} v={manager ? leadCount ?? 0 : b.weekly_footfall ? num(b.weekly_footfall) : "—"} />
            </div>
            {b.lat && b.lng && <StopsMap points={[{ id, lat: Number(b.lat), lng: Number(b.lng), label: b.name, sub: b.address ?? undefined }]} height={220} />}
            <Card title="Details">
              <KV rows={[["Type", b.business_type], ["Language", b.language === "es" ? "Spanish" : b.language === "en" ? "English" : "Bilingual"], ["Cadence", titleCase(b.cadence)], ["Placements", (b.placement_types ?? []).join(", ") || "—"], ["Tags", (b.tags ?? []).join(", ") || "—"], ["Source", b.source], ["Added", fdate(b.created_at, "MMM d, yyyy")], ["Approved", b.approved_at ? fdate(b.approved_at, "MMM d, yyyy") : "—"]]} />
              {b.notes && <p className="text-[13px] mt-3 whitespace-pre-wrap border-l-2 border-brand pl-3">{b.notes}</p>}
              {b.ineligibility_reason && <p className="text-[13px] mt-3 text-bad">Ineligible: {b.ineligibility_reason}</p>}
            </Card>
          </div>
          <div className="space-y-4">
            <Card title="Contacts" pad={false}>
              {(contacts ?? []).length === 0 && <div className="p-4 text-[13px] text-ts">No contact on file.</div>}
              {(contacts ?? []).map((c) => (
                <div key={c.id} className="lrow"><div className="flex-1 min-w-0"><div className="font-bold text-[13.5px]">{c.name}{c.is_primary && <span className="ml-2 pill pill-brand">primary</span>}</div><div className="text-[12px] text-ts">{c.contact_role ?? ""}{c.phone ? ` · ${c.phone}` : ""}{c.email ? ` · ${c.email}` : ""}</div></div>{c.phone && <a href={`tel:${c.phone}`} className="btn btn-ghost btn-sm"><Icon name="phone" size={15} /></a>}</div>
              ))}
              {canEdit && (
                <form action={addContact} className="grid grid-cols-2 gap-2 p-3 border-t border-line2">
                  <input type="hidden" name="business_id" value={id} />
                  <input name="name" placeholder="Name" className="input !py-2 !text-[13px]" required /><input name="contact_role" placeholder="Role" className="input !py-2 !text-[13px]" />
                  <input name="phone" placeholder="Phone" className="input !py-2 !text-[13px]" /><input name="email" placeholder="Email" className="input !py-2 !text-[13px]" />
                  <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" name="is_primary" /> Primary</label><button className="btn btn-sm">Add contact</button>
                </form>
              )}
            </Card>
            <Card title="Recent visits" meta={<Link href={`${base}?tab=history`} className="font-bold text-tp">All →</Link>} pad={false}>
              {completed.slice(0, 4).map((v) => <Link key={v.id} href={`/routes/${v.route_id}/stops/${v.id}`} className="lrow"><div className="flex-1 min-w-0"><div className="text-[13px] font-bold">{titleCase(v.outcome)} <span className="text-tt font-medium">· {fdate(v.completed_at, "MMM d")}</span></div><div className="text-[11.5px] text-tt truncate">{one(v.rep)?.full_name}{v.notes ? ` · ${v.notes}` : ""}</div></div>{v.photos?.length ? <span className="pill pill-neutral">{v.photos.length} 📷</span> : null}</Link>)}
              {completed.length === 0 && <div className="p-4 text-[13px] text-ts">No visits recorded yet.</div>}
            </Card>
          </div>
        </div>
      )}

      {tab === "history" && (
        <Card pad={false}>
          {(visits ?? []).length === 0 ? <div className="p-4"><Empty title="No visits yet" /></div> : (visits ?? []).map((v) => (
            <Link key={v.id} href={`/routes/${v.route_id}/stops/${v.id}`} className="lrow">
              <div className={`w-2.5 h-2.5 rounded-full flex-none ${v.completed_at ? (["materials_placed", "restocked", "verified_only"].includes(v.outcome) ? "bg-ok" : "bg-warn") : "bg-line"}`} />
              <div className="flex-1 min-w-0"><div className="text-[13.5px] font-bold">{v.completed_at ? titleCase(v.outcome) : "Planned"} <span className="text-tt font-medium">· {fdate(v.completed_at ?? v.arrived_at, "MMM d, yyyy")}</span></div><div className="text-[12px] text-tt truncate">{one(v.rep)?.full_name}{v.poc_spoken_to ? ` · spoke to ${v.poc_spoken_to}` : ""}{v.placement_verified === false ? " · placement NOT verified" : ""}{v.notes ? ` · ${v.notes}` : ""}</div></div>
              {v.photos?.length ? <span className="pill pill-neutral">{v.photos.length} 📷</span> : <span className="pill pill-warn">no photo</span>}
            </Link>
          ))}
        </Card>
      )}

      {tab === "leads" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <Card title="Store QR code">
            {leadForm ? (
              <div className="text-center">
                <img src={`/api/qr/${leadForm.slug}?size=480`} alt="QR code" className="mx-auto w-[220px] h-[220px] rounded-lg border border-line bg-white" />
                <p className="text-[12.5px] text-ts mt-3 break-all"><a href={`${appUrl}/l/${leadForm.slug}`} target="_blank" rel="noreferrer" className="font-bold text-tp">{appUrl}/l/{leadForm.slug}</a></p>
                <div className="flex justify-center gap-2 mt-3 flex-wrap">
                  <a className="btn btn-sm" href={`/api/qr/${leadForm.slug}?size=1200`} download={`qr-${leadForm.slug}.png`}><Icon name="download" size={14} /> PNG</a>
                  <a className="btn btn-sm" href={`/api/qr/${leadForm.slug}?fmt=svg`} download={`qr-${leadForm.slug}.svg`}><Icon name="download" size={14} /> SVG for print</a>
                  <a className="btn btn-sm" href={`/l/${leadForm.slug}`} target="_blank" rel="noreferrer"><Icon name="external" size={14} /> Preview form</a>
                </div>
                <p className="text-[11.5px] text-tt mt-3">Scans land with tags <b>{[...(leadForm.tags ?? []), `store:${leadForm.slug}`].join(", ")}</b> so ClickUp can filter by store.</p>
              </div>
            ) : <Empty title="No lead form yet" hint="Save the settings on the right to create the QR form for this store." />}
          </Card>
          <Card title="Lead form & webhook">
            <form action={saveLeadForm} className="grid sm:grid-cols-2 gap-3">
              <input type="hidden" name="business_id" value={id} /><input type="hidden" name="lead_form_id" value={leadForm?.id ?? ""} />
              <label className="field !mb-0 sm:col-span-2"><span>Webhook URL for this store (ClickUp / Make / Zapier)</span><input name="webhook_url" type="url" defaultValue={leadForm?.webhook_url ?? ""} placeholder="https://hooks…" /><span className="hint">Receives a JSON POST per lead with a ClickUp-ready task name, description and tags. Leave empty to use the default webhook from Admin.</span></label>
              <label className="field !mb-0"><span>Webhook secret (optional)</span><input name="webhook_secret" defaultValue={leadForm?.webhook_secret ?? ""} placeholder="HMAC signature key" /></label>
              <label className="field !mb-0"><span>Also email leads to</span><input name="notify_email" type="email" defaultValue={leadForm?.notify_email ?? ""} placeholder="inbox override" /></label>
              <label className="field !mb-0 sm:col-span-2"><span>Tags (comma separated)</span><input name="tags" defaultValue={(leadForm?.tags ?? []).join(", ")} placeholder="store-name, plaza, tv-campaign" /></label>
              <label className="field !mb-0"><span>Form language</span><select name="language" defaultValue={leadForm?.language ?? b.language ?? "es"}><option value="es">Spanish</option><option value="en">English</option></select></label>
              <label className="flex items-center gap-2 text-[13px] font-semibold self-end pb-2"><input type="checkbox" name="is_active" defaultChecked={leadForm ? leadForm.is_active : true} className="w-4 h-4 accent-[var(--brand)]" /> Form active</label>
              <label className="field !mb-0 sm:col-span-2"><span>Headline</span><input name="headline" defaultValue={leadForm?.headline ?? ""} placeholder="¿Tuviste un accidente?" /></label>
              <label className="field !mb-0 sm:col-span-2"><span>Intro</span><textarea name="intro" defaultValue={leadForm?.intro ?? ""} className="!min-h-[60px]" /></label>
              <div className="sm:col-span-2 flex justify-end"><button className="btn btn-pri">{leadForm ? "Save" : "Create QR form"}</button></div>
            </form>
            {manager && <p className="text-[12px] text-ts mt-3"><Link href={`/leads?business=${id}`} className="font-bold text-tp">See leads from this store →</Link></p>}
          </Card>
        </div>
      )}

      {tab === "contracts" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <Card title="Contract requests" pad={false}>
            {(contracts ?? []).length === 0 && <div className="p-4 text-[13px] text-ts">No contract requested yet.</div>}
            {(contracts ?? []).map((c) => (
              <div key={c.id} className="p-4 border-b border-line2 last:border-b-0">
                <div className="flex items-center gap-2 flex-wrap"><b className="text-[16px] tabular">{usd(Number(c.agreed_monthly_fee))}</b><span className="text-tt text-[12px]">/month · {c.term_months} mo</span><Pill tone={statusTone(c.status)}>{c.status}</Pill></div>
                <div className="text-[12.5px] text-ts mt-1">To {c.contact_name ? `${c.contact_name} · ` : ""}{c.contact_email} · by {c.rep?.full_name} · {fdate(c.created_at, "MMM d")}{c.sent_at ? ` · sent ${fdate(c.sent_at, "MMM d")}` : ""}</div>
                {(c.placement_types ?? []).length > 0 && <div className="text-[12px] mt-1">{c.placement_types.join(", ")}</div>}
                {c.notes && <p className="text-[12.5px] mt-1 border-l-2 border-brand pl-2">{c.notes}</p>}
                <div className="flex gap-1 mt-2">
                  {manager && ["requested", "sent"].includes(c.status) && <Link href="/contracts" className="btn btn-sm">Send from contracts →</Link>}
                  {manager && c.status !== "signed" && <form action={setContractStatus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="signed" /><input type="hidden" name="back" value={`${base}?tab=contracts`} /><button className="btn btn-sm">Mark signed</button></form>}
                  {c.requested_by === user.id && c.status === "requested" && <form action={setContractStatus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="cancelled" /><input type="hidden" name="back" value={`${base}?tab=contracts`} /><button className="btn btn-ghost btn-sm">Cancel</button></form>}
                </div>
              </div>
            ))}
          </Card>
          {canEdit && (
            <Card title="Request a contract">
              <div className="callout mb-3"><b>Area band {usd(Number(preset?.monthly_min ?? 200))} – {usd(Number(preset?.monthly_max ?? 1000))}/month.</b>{latestAssessment ? ` Manager assessed ${usd(Number(latestAssessment.suggested_fee))}.` : ""}</div>
              <form action={requestContract} className="grid sm:grid-cols-2 gap-3">
                <input type="hidden" name="business_id" value={id} />
                <label className="field !mb-0"><span>Contact name</span><input name="contact_name" defaultValue={contacts?.[0]?.name ?? ""} /></label>
                <label className="field !mb-0"><span>Contact email</span><input name="contact_email" type="email" required defaultValue={contacts?.[0]?.email ?? ""} /></label>
                <label className="field !mb-0"><span>Contact phone</span><input name="contact_phone" defaultValue={contacts?.[0]?.phone ?? b.phone ?? ""} /></label>
                <label className="field !mb-0"><span>Agreed monthly rate ($)</span><input type="number" name="agreed_monthly_fee" step={25} min={Number(preset?.monthly_min ?? 0)} max={manager ? undefined : Number(preset?.monthly_max ?? 1000)} defaultValue={latestAssessment?.suggested_fee ?? preset?.default_fee ?? 350} required /></label>
                <label className="field !mb-0"><span>Term (months)</span><input type="number" name="term_months" min={1} defaultValue={12} /></label>
                <label className="field !mb-0"><span>Start</span><input type="date" name="start_date" /></label>
                <div className="sm:col-span-2"><span className="label">Placements</span><div className="flex flex-wrap gap-1.5">{PLACEMENT_TYPES.map((p) => <label key={p} className="chip cursor-pointer has-[:checked]:border-brand has-[:checked]:bg-brand-tint has-[:checked]:text-tp"><input type="checkbox" name="placement_types" value={p} defaultChecked={(b.placement_types ?? []).includes(p)} className="hidden" />{p}</label>)}</div></div>
                <label className="field !mb-0 sm:col-span-2"><span>Notes</span><textarea name="notes" className="!min-h-[60px]" /></label>
                <div className="sm:col-span-2 flex justify-end"><button className="btn btn-pri"><Icon name="send" size={15} /> Request contract</button></div>
              </form>
            </Card>
          )}
        </div>
      )}

      {tab === "value" && manager && (
        <div className="space-y-4">
          <Card title="Monthly placement value calculator" meta={preset ? `Area band ${usd(Number(preset.monthly_min))}–${usd(Number(preset.monthly_max))}` : undefined}>
            <ValueCalculator tiers={(tiers ?? []) as RateCardTier[]} preset={preset} initial={{ footfall: b.weekly_footfall, placements: b.placement_types }} businessId={id} action={saveAssessment} canSave />
          </Card>
          <Card title="Assessment history" pad={false}>
            {(assessments ?? []).length === 0 && <div className="p-4 text-[13px] text-ts">No assessments yet.</div>}
            {(assessments ?? []).map((a) => <div key={a.id} className="lrow"><div className="flex-1"><div className="text-[13.5px] font-bold">{usd(Number(a.suggested_fee))}/month <span className="text-tt font-medium">· tier {a.tier_code ?? "—"} · {fdate(a.created_at, "MMM d, yyyy")}</span></div><div className="text-[12px] text-tt">{a.by?.full_name} · footfall {num(a.weekly_footfall)} · visibility {a.visibility_score}/5 · fit {a.community_fit}/5 · {a.exclusivity}{a.notes ? ` · ${a.notes}` : ""}</div></div></div>)}
          </Card>
          {(pricing ?? []).length > 0 && <Card title="Placement agreements on file" pad={false}>{(pricing ?? []).map((p) => <div key={p.id} className="lrow"><span className="flex-1 text-[13px]"><b>{titleCase(p.status)}</b>{p.term_start ? ` · ${p.term_start} → ${p.term_end ?? "open"}` : ""}</span><b className="tabular">{p.pricing?.[0] ? usd(Number(p.pricing[0].monthly_fee)) : "—"}</b></div>)}</Card>}
        </div>
      )}

      {tab === "edit" && canEdit && (
        <Card title="Edit business">
          <form action={updateBusiness} className="grid sm:grid-cols-2 gap-3">
            <input type="hidden" name="id" value={id} />
            <label className="field !mb-0 sm:col-span-2"><span>Name</span><input name="name" required defaultValue={b.name} /></label>
            <label className="field !mb-0"><span>Type</span><select name="business_type" defaultValue={b.business_type}>{Array.from(new Set([...BUSINESS_TYPES, b.business_type])).map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
            <label className="field !mb-0"><span>Language</span><select name="language" defaultValue={b.language}><option value="es">Spanish</option><option value="en">English</option><option value="both">Both</option></select></label>
            <label className="field !mb-0 sm:col-span-2"><span>Address</span><input name="address" defaultValue={b.address ?? ""} /></label>
            <label className="field !mb-0"><span>City</span><input name="city" defaultValue={b.city ?? ""} /></label>
            <label className="field !mb-0"><span>Phone</span><input name="phone" defaultValue={b.phone ?? ""} /></label>
            <label className="field !mb-0"><span>Cadence</span><select name="cadence" defaultValue={b.cadence}>{["weekly", "biweekly", "monthly", "quarterly", "on_request"].map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}</select></label>
            <label className="field !mb-0"><span>Weekly footfall</span><input type="number" name="weekly_footfall" defaultValue={b.weekly_footfall ?? ""} /></label>
            {manager && <label className="field !mb-0"><span>Status</span><select name="status" defaultValue={b.status}>{["prospect", "active", "paused", "declined", "archived"].map((s) => <option key={s} value={s}>{s}</option>)}</select></label>}
            {manager && reps && <label className="field !mb-0"><span>Assigned rep</span><select name="assigned_rep_id" defaultValue={b.assigned_rep_id ?? ""}><option value="">Unassigned</option>{reps.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}</select></label>}
            <label className="field !mb-0"><span>Latitude</span><input name="lat" defaultValue={b.lat ?? ""} /></label>
            <label className="field !mb-0"><span>Longitude</span><input name="lng" defaultValue={b.lng ?? ""} /></label>
            <label className="field !mb-0 sm:col-span-2"><span>Tags</span><input name="tags" defaultValue={(b.tags ?? []).join(", ")} /></label>
            <div className="sm:col-span-2"><span className="label">Placements</span><div className="flex flex-wrap gap-1.5">{PLACEMENT_TYPES.map((p) => <label key={p} className="chip cursor-pointer has-[:checked]:border-brand has-[:checked]:bg-brand-tint has-[:checked]:text-tp"><input type="checkbox" name="placement_types" value={p} defaultChecked={(b.placement_types ?? []).includes(p)} className="hidden" />{p}</label>)}</div></div>
            <label className="field !mb-0 sm:col-span-2"><span>Notes</span><textarea name="notes" defaultValue={b.notes ?? ""} /></label>
            <div className="sm:col-span-2"><GeoFields /><span className="hint">Capturing your location while standing at the store fills in the map pin.</span></div>
            <div className="sm:col-span-2 flex justify-end"><button className="btn btn-pri">Save changes</button></div>
          </form>
        </Card>
      )}
    </div>
  );
}
