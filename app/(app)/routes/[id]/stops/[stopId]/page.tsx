import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser, isManager } from "@/lib/auth";
import { Card, Pill, BackLink, KV, statusTone } from "@/components/ui";
import { Checklist } from "@/components/routes/Checklist";
import { PhotoUploader } from "@/components/routes/PhotoUploader";
import { GeoFields } from "@/components/routes/GeoButton";
import { Toast } from "@/components/shell/Toast";
import { Icon } from "@/components/shell/Icon";
import { fdate, ftime, titleCase, todayISO, one } from "@/lib/format";
import { OUTCOMES, type RouteTask } from "@/lib/types";
import { arriveStop, completeStop, reopenStop, saveStopNote, deletePhoto } from "../../../actions";

export default async function StopPage({ params }: { params: Promise<{ id: string; stopId: string }> }) {
  const { id, stopId } = await params;
  const { supabase, role, user } = await requireUser();
  const { data: stop } = await supabase.from("stops").select("*, business:businesses(*), route:routes(id,status,rep_id,route_date)").eq("id", stopId).eq("route_id", id).maybeSingle();
  if (!stop) notFound();
  const b = stop.business;
  const [{ data: tasks }, { data: materials }, { data: photos }, { data: history }, { data: contacts }, { data: leadForm }] = await Promise.all([
    supabase.from("route_tasks").select("*").eq("route_id", id).eq("stop_id", stopId),
    supabase.from("materials").select("id,name,qty_on_hand").order("name"),
    supabase.from("stop_photos").select("*").eq("stop_id", stopId).order("taken_at"),
    supabase.from("stops").select("id,route_id,completed_at,outcome,poc_spoken_to,notes,materials_left, rep:profiles!stops_rep_id_fkey(full_name)").eq("business_id", stop.business_id).neq("id", stopId).not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(4),
    supabase.from("business_contacts").select("*").eq("business_id", stop.business_id).order("is_primary", { ascending: false }),
    supabase.from("lead_forms").select("slug").eq("business_id", stop.business_id).maybeSingle(),
  ]);
  const signed = photos && photos.length ? (await supabase.storage.from("stop-photos").createSignedUrls(photos.map((p) => p.storage_path), 3600)).data ?? [] : [];
  const urlFor = (path: string) => signed.find((s) => s.path === path)?.signedUrl ?? null;
  const mine = stop.rep_id === user.id;
  const manager = isManager(role);
  const canEdit = (mine || manager) && !stop.completed_at && !["submitted", "reviewed"].includes(stop.route?.status);
  const back = `/routes/${id}/stops/${stopId}`;
  const mapsUrl = b?.address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${b.address}${b.city ? ", " + b.city : ""}`)}` : b?.lat ? `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}` : null;

  return (
    <div>
      <Suspense><Toast /></Suspense>
      <BackLink href={`/routes/${id}`} label="Route" />
      <div className="pagehead">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1>{b?.name}</h1>
            <Pill tone={statusTone(b?.status)}>{b?.status}</Pill>
            {stop.completed_at && <Pill tone={OUTCOMES.find((o) => o.value === stop.outcome)?.good ? "ok" : "warn"}>{titleCase(stop.outcome)}</Pill>}
          </div>
          <p>Stop {stop.seq} · {b?.business_type}{b?.city ? ` · ${b.city}` : ""}{b?.needs_detail ? " · address needs confirming" : ""}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn"><Icon name="navigate" size={16} /> Navigate</a>}
          {b?.phone && <a href={`tel:${b.phone}`} className="btn"><Icon name="phone" size={16} /> Call</a>}
          <Link href={`/businesses/${b?.id}`} className="btn btn-ghost">Account →</Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          {canEdit && !stop.arrived_at && (
            <form action={arriveStop} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <input type="hidden" name="route_id" value={id} /><input type="hidden" name="stop_id" value={stopId} />
              <div className="flex-1"><div className="font-extrabold text-[15px]">At the door?</div><div className="text-[12.5px] text-ts">Tap arrive to time the visit and capture where you are.</div></div>
              <GeoFields />
              <button className="btn btn-pri btn-lg"><Icon name="pin" size={16} /> Arrive</button>
            </form>
          )}

          <Checklist tasks={(tasks ?? []) as RouteTask[]} phase="pre" routeId={id} stopId={stopId} back={back} title="Arriving" locked={!canEdit} />

          {canEdit ? (
            <Card title="Report this stop" meta={stop.arrived_at ? `Arrived ${ftime(stop.arrived_at)}` : undefined}>
              <form action={completeStop} className="space-y-4">
                <input type="hidden" name="route_id" value={id} /><input type="hidden" name="stop_id" value={stopId} /><input type="hidden" name="business_id" value={stop.business_id} />
                <div>
                  <span className="label">Outcome</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {OUTCOMES.map((o) => (
                      <label key={o.value} className="flex items-center gap-2 border border-line rounded-lg px-3 py-2.5 cursor-pointer has-[:checked]:border-brand has-[:checked]:bg-brand-tint">
                        <input type="radio" name="outcome" value={o.value} required className="accent-[var(--brand)]" /><span className="text-[13px] font-semibold">{o.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="field !mb-0"><span>Visit type</span>
                    <select name="visit_type" defaultValue={stop.visit_type}>{["first_visit", "restock", "verification", "content", "followup"].map((v) => <option key={v} value={v}>{titleCase(v)}</option>)}</select>
                  </label>
                  <label className="field !mb-0"><span>Who you spoke to</span><input name="poc" placeholder="Name and role" defaultValue={contacts?.[0]?.name ?? ""} /></label>
                </div>
                <div>
                  <span className="label">Materials left</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(materials ?? []).map((m) => (
                      <label key={m.id} className="field !mb-0"><span className="truncate normal-case tracking-normal font-semibold text-ts">{m.name}</span><input type="number" name={`mat_${m.id}`} min={0} inputMode="numeric" placeholder="0" /></label>
                    ))}
                  </div>
                  <p className="hint">These are deducted from stock automatically when you submit.</p>
                </div>
                <label className="flex items-center gap-2 text-[13.5px] font-semibold"><input type="checkbox" name="placement_verified" defaultChecked className="w-4 h-4 accent-[var(--brand)]" /> Placement is up and visible</label>
                <label className="field !mb-0"><span>Note</span><textarea name="notes" placeholder="What you saw, what the owner said, anything to follow up" /></label>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="field !mb-0"><span>Follow-up date (optional)</span><input type="date" name="follow_up_date" min={todayISO()} /></label>
                  <label className="field !mb-0"><span>Verification note</span><input name="verification_note" placeholder="e.g. decal replaced, poster moved to counter" /></label>
                </div>
                <div className="flex justify-end"><button className="btn btn-pri btn-lg"><Icon name="check" size={16} /> Complete stop</button></div>
              </form>
            </Card>
          ) : (
            <Card title="Report" meta={stop.completed_at ? `Completed ${fdate(stop.completed_at, "MMM d, h:mm a")}` : "Not reported yet"}>
              {stop.completed_at ? (
                <>
                  <KV rows={[["Outcome", titleCase(stop.outcome)], ["Visit type", titleCase(stop.visit_type)], ["Spoke to", stop.poc_spoken_to], ["Placement", stop.placement_verified ? "Verified" : "Not verified"], ["Duration", stop.duration_min ? `${stop.duration_min} min` : "—"], ["Follow-up", stop.follow_up_date ?? (stop.follow_up_needed ? "Needed" : "None")], ["Materials left", <MaterialsList key="m" left={stop.materials_left} materials={materials ?? []} />]]} />
                  {stop.notes && <p className="mt-3 text-[13.5px] whitespace-pre-wrap border-l-2 border-brand pl-3">{stop.notes}</p>}
                  {manager && (
                    <form action={reopenStop} className="mt-4"><input type="hidden" name="route_id" value={id} /><input type="hidden" name="stop_id" value={stopId} /><button className="btn btn-sm">Reopen for editing</button></form>
                  )}
                </>
              ) : (
                <p className="text-[13px] text-ts">This stop is on another rep's route or the route is closed.</p>
              )}
              {stop.completed_at && (mine || manager) && (
                <form action={saveStopNote} className="mt-4 flex gap-2 items-end">
                  <input type="hidden" name="route_id" value={id} /><input type="hidden" name="stop_id" value={stopId} />
                  <label className="field !mb-0 flex-1"><span>Update note</span><textarea name="notes" defaultValue={stop.notes ?? ""} className="!min-h-[60px]" /></label>
                  <button className="btn btn-sm">Save</button>
                </form>
              )}
            </Card>
          )}

          <Checklist tasks={(tasks ?? []) as RouteTask[]} phase="post" routeId={id} stopId={stopId} back={back} title="Leaving" locked={!canEdit} />
        </div>

        <div className="space-y-4">
          <Card title="Photos" meta={`${photos?.length ?? 0}`} actions={(mine || manager) && !["submitted", "reviewed"].includes(stop.route?.status) ? <PhotoUploader stopId={stopId} /> : undefined}>
            {!photos || photos.length === 0 ? (
              <p className="text-[13px] text-ts">No photos yet. Proof of placement is required at every stop.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {photos.map((p) => {
                  const u = urlFor(p.storage_path);
                  return (
                    <div key={p.id} className="relative group rounded-lg overflow-hidden border border-line aspect-square bg-line2">
                      {u && <a href={u} target="_blank" rel="noreferrer"><img src={u} alt={p.caption ?? p.kind} className="w-full h-full object-cover" /></a>}
                      <span className="absolute left-1.5 top-1.5 pill pill-brand">{p.kind}</span>
                      {(mine || manager) && (
                        <form action={deletePhoto} className="absolute right-1.5 top-1.5"><input type="hidden" name="photo_id" value={p.id} /><input type="hidden" name="back" value={back} /><button className="w-7 h-7 rounded-full bg-black/70 text-white grid place-items-center" aria-label="Delete photo"><Icon name="trash" size={13} /></button></form>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title="Account">
            <KV rows={[["Address", b?.address ? `${b.address}${b.city ? ", " + b.city : ""}` : "Not on file"], ["Phone", b?.phone ? <a key="p" href={`tel:${b.phone}`} className="font-bold">{b.phone}</a> : "—"], ["Language", b?.language === "es" ? "Spanish" : b?.language === "en" ? "English" : "Bilingual"], ["Cadence", titleCase(b?.cadence)], ["Last visit", b?.last_visit_at ? fdate(b.last_visit_at, "MMM d, yyyy") : "Never"], ["Contact", contacts?.[0] ? `${contacts[0].name}${contacts[0].contact_role ? ` (${contacts[0].contact_role})` : ""}` : "—"]]} />
            {b?.notes && <p className="text-[12.5px] text-ts mt-3 whitespace-pre-wrap">{b.notes}</p>}
            <div className="mt-3 flex gap-2 flex-wrap">
              <Link href={`/businesses/${b?.id}?tab=leads`} className="btn btn-sm"><Icon name="qr" size={14} /> {leadForm ? "Store QR code" : "Set up QR lead form"}</Link>
            </div>
          </Card>

          <Card title="Previous visits" pad={false}>
            {!history || history.length === 0 ? <div className="p-4 text-[13px] text-ts">First recorded visit.</div> : history.map((h) => (
              <Link key={h.id} href={`/routes/${h.route_id}/stops/${h.id}`} className="lrow">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold">{titleCase(h.outcome)} <span className="text-tt font-medium">· {fdate(h.completed_at, "MMM d")}</span></div>
                  <div className="text-[11.5px] text-tt truncate">{one(h.rep)?.full_name}{h.poc_spoken_to ? ` · spoke to ${h.poc_spoken_to}` : ""}{h.notes ? ` · ${h.notes}` : ""}</div>
                </div>
              </Link>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

function MaterialsList({ left, materials }: { left: Record<string, number>; materials: { id: string; name: string }[] }) {
  const entries = Object.entries(left ?? {}).filter(([, v]) => Number(v) > 0);
  if (entries.length === 0) return <span>None</span>;
  return <span>{entries.map(([k, v]) => `${materials.find((m) => m.id === k)?.name ?? titleCase(k)} × ${v}`).join(", ")}</span>;
}
