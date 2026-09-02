"use server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, isManager } from "@/lib/auth";
import { done, fail, str, numOrNull, list } from "@/lib/actions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function seedTasks(supabase: Awaited<ReturnType<typeof createClient>>, routeId: string, territoryId: string | null, stops: { id: string; business_type?: string | null }[]) {
  const { data: templates } = await supabase.from("checklist_templates").select("*").eq("is_active", true);
  const rows: Record<string, unknown>[] = [];
  const pick = (scope: string, bt?: string | null) =>
    (templates ?? []).filter((t) => t.scope === scope && (t.territory_id == null || t.territory_id === territoryId) && (t.business_type == null || t.business_type === bt));
  for (const t of pick("route_pre")) (t.items as { label: string; required?: boolean }[]).forEach((it, i) => rows.push({ route_id: routeId, phase: "pre", label: it.label, required: !!it.required, sort_order: i, source_template_id: t.id }));
  for (const t of pick("route_post")) (t.items as { label: string; required?: boolean }[]).forEach((it, i) => rows.push({ route_id: routeId, phase: "post", label: it.label, required: !!it.required, sort_order: i, source_template_id: t.id }));
  for (const s of stops) {
    for (const t of pick("stop_pre", s.business_type)) (t.items as { label: string; required?: boolean }[]).forEach((it, i) => rows.push({ route_id: routeId, stop_id: s.id, phase: "pre", label: it.label, required: !!it.required, sort_order: i, source_template_id: t.id }));
    for (const t of pick("stop_post", s.business_type)) (t.items as { label: string; required?: boolean }[]).forEach((it, i) => rows.push({ route_id: routeId, stop_id: s.id, phase: "post", label: it.label, required: !!it.required, sort_order: i, source_template_id: t.id }));
  }
  if (rows.length) await supabase.from("route_tasks").insert(rows);
}

export async function createRoute(fd: FormData) {
  const { user, profile, supabase, role } = await requireUser();
  const route_date = str(fd, "route_date");
  const repId = isManager(role) && str(fd, "rep_id") ? str(fd, "rep_id") : user.id;
  let businessIds: string[] = [];
  try { businessIds = JSON.parse(str(fd, "stops") || "[]"); } catch { businessIds = []; }
  if (!route_date) fail("/routes/new", "Pick a date.");
  if (businessIds.length === 0) fail("/routes/new", "Add at least one stop.");
  const materials: Record<string, number> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith("mat_") && Number(v) > 0) materials[k.slice(4)] = Number(v);

  const { data: route, error } = await supabase
    .from("routes")
    .insert({ route_date, rep_id: repId, territory_id: profile.territory_id, status: "planned", planned_stops: businessIds.length, materials_taken: materials, notes: str(fd, "notes") || null, created_by: user.id })
    .select("id")
    .single();
  if (error || !route) fail("/routes/new", error?.message ?? "Could not create the route.");

  const { data: bizRows } = await supabase.from("businesses").select("id,business_type,status").in("id", businessIds);
  const byId = new Map((bizRows ?? []).map((b) => [b.id, b]));
  const stopRows = businessIds.map((bid, i) => ({ route_id: route.id, business_id: bid, rep_id: repId, seq: i + 1, visit_type: byId.get(bid)?.status === "prospect" ? "first_visit" : "restock" }));
  const { data: stops, error: se } = await supabase.from("stops").insert(stopRows).select("id,business_id");
  if (se) fail("/routes/new", se.message);
  await seedTasks(supabase, route.id, profile.territory_id, (stops ?? []).map((s) => ({ id: s.id, business_type: byId.get(s.business_id)?.business_type })));
  revalidatePath("/routes");
  redirect(`/routes/${route.id}?ok=${encodeURIComponent("Route created")}`);
}

export async function startRoute(fd: FormData) {
  const { supabase } = await requireUser();
  const id = str(fd, "route_id");
  const { error } = await supabase.from("routes").update({ status: "in_progress", started_at: new Date().toISOString(), odometer_start: numOrNull(fd, "odometer_start") }).eq("id", id);
  if (error) fail(`/routes/${id}`, error.message);
  done(`/routes/${id}`, "Route started. Drive safe.");
}

export async function endRoute(fd: FormData) {
  const { supabase } = await requireUser();
  const id = str(fd, "route_id");
  const { data: open } = await supabase.from("route_tasks").select("id").eq("route_id", id).eq("phase", "post").is("stop_id", null).eq("required", true).eq("done", false);
  if (open && open.length > 0) fail(`/routes/${id}`, "Finish the required end-of-route checklist first.");
  const patch: Record<string, unknown> = { status: "submitted", ended_at: new Date().toISOString(), odometer_end: numOrNull(fd, "odometer_end"), notes: str(fd, "notes") || null };
  const manualMiles = numOrNull(fd, "mileage");
  if (manualMiles != null) patch.mileage = manualMiles;
  const { error } = await supabase.from("routes").update(patch).eq("id", id);
  if (error) fail(`/routes/${id}`, error.message);
  done(`/routes/${id}`, "Route submitted. Nice work.");
}

export async function interruptRoute(fd: FormData) {
  const { supabase } = await requireUser();
  const id = str(fd, "route_id");
  const { error } = await supabase.from("routes").update({ interrupted: true, interruption_reason: str(fd, "reason") || "other", interruption_note: str(fd, "note") || null, status: "submitted", ended_at: new Date().toISOString() }).eq("id", id);
  if (error) fail(`/routes/${id}`, error.message);
  done(`/routes/${id}`, "Route marked as interrupted.");
}

export async function reviewRoute(fd: FormData) {
  const { supabase, role } = await requireUser();
  const id = str(fd, "route_id");
  if (!isManager(role)) fail(`/routes/${id}`, "Managers only.");
  const { error } = await supabase.from("routes").update({ status: "reviewed" }).eq("id", id);
  if (error) fail(`/routes/${id}`, error.message);
  done(`/routes/${id}`, "Route reviewed.");
}

export async function deleteRoute(fd: FormData) {
  const { supabase } = await requireUser();
  const id = str(fd, "route_id");
  const { error } = await supabase.from("routes").delete().eq("id", id);
  if (error) fail(`/routes/${id}`, error.message);
  revalidatePath("/routes");
  redirect(`/routes?ok=${encodeURIComponent("Route deleted")}`);
}

export async function toggleTask(fd: FormData) {
  const { supabase, user } = await requireUser();
  const id = str(fd, "task_id");
  const back = str(fd, "back");
  const doneNow = str(fd, "done") === "true";
  await supabase.from("route_tasks").update({ done: doneNow, done_at: doneNow ? new Date().toISOString() : null, done_by: doneNow ? user.id : null }).eq("id", id);
  revalidatePath(back);
}

export async function addTask(fd: FormData) {
  const { supabase } = await requireUser();
  const back = str(fd, "back");
  const label = str(fd, "label");
  if (!label) fail(back, "Write the task first.");
  const { error } = await supabase.from("route_tasks").insert({ route_id: str(fd, "route_id"), stop_id: str(fd, "stop_id") || null, phase: str(fd, "phase") || "pre", label, sort_order: 99 });
  if (error) fail(back, error.message);
  done(back, "Task added");
}

export async function addExpense(fd: FormData) {
  const { supabase, user } = await requireUser();
  const id = str(fd, "route_id");
  const amount = numOrNull(fd, "amount");
  if (amount == null || amount < 0) fail(`/routes/${id}`, "Enter an amount.");
  const { error } = await supabase.from("route_expenses").insert({ route_id: id, rep_id: user.id, kind: str(fd, "kind") || "other", amount, note: str(fd, "note") || null, receipt_path: str(fd, "receipt_path") || null });
  if (error) fail(`/routes/${id}`, error.message);
  done(`/routes/${id}`, "Expense added");
}

export async function addStopToRoute(fd: FormData) {
  const { supabase, user } = await requireUser();
  const id = str(fd, "route_id");
  const bid = str(fd, "business_id");
  const { data: route } = await supabase.from("routes").select("rep_id,territory_id").eq("id", id).single();
  const { count } = await supabase.from("stops").select("id", { count: "exact", head: true }).eq("route_id", id);
  const { data: biz } = await supabase.from("businesses").select("business_type,status").eq("id", bid).single();
  const { data: stop, error } = await supabase.from("stops").insert({ route_id: id, business_id: bid, rep_id: route?.rep_id ?? user.id, seq: (count ?? 0) + 1, visit_type: biz?.status === "prospect" ? "first_visit" : "restock" }).select("id").single();
  if (error || !stop) fail(`/routes/${id}`, error?.message ?? "Could not add stop");
  await seedTasks(supabase, id, route?.territory_id ?? null, [{ id: stop.id, business_type: biz?.business_type }]);
  await supabase.from("routes").update({ planned_stops: (count ?? 0) + 1 }).eq("id", id);
  done(`/routes/${id}`, "Stop added");
}

export async function removeStop(fd: FormData) {
  const { supabase } = await requireUser();
  const id = str(fd, "route_id");
  const { error } = await supabase.from("stops").delete().eq("id", str(fd, "stop_id")).is("completed_at", null);
  if (error) fail(`/routes/${id}`, error.message);
  done(`/routes/${id}`, "Stop removed");
}

export async function moveStop(fd: FormData) {
  const { supabase } = await requireUser();
  const id = str(fd, "route_id");
  const dir = str(fd, "dir") === "up" ? -1 : 1;
  const { data: stops } = await supabase.from("stops").select("id,seq").eq("route_id", id).order("seq");
  if (!stops) return;
  const i = stops.findIndex((s) => s.id === str(fd, "stop_id"));
  const j = i + dir;
  if (i < 0 || j < 0 || j >= stops.length) return;
  await supabase.from("stops").update({ seq: stops[j].seq }).eq("id", stops[i].id);
  await supabase.from("stops").update({ seq: stops[i].seq }).eq("id", stops[j].id);
  revalidatePath(`/routes/${id}`);
}

/* ---------- stop visit ---------- */
export async function arriveStop(fd: FormData) {
  const { supabase } = await requireUser();
  const routeId = str(fd, "route_id"); const stopId = str(fd, "stop_id");
  const lat = numOrNull(fd, "lat"); const lng = numOrNull(fd, "lng");
  const { error } = await supabase.from("stops").update({ arrived_at: new Date().toISOString(), lat, lng }).eq("id", stopId);
  if (error) fail(`/routes/${routeId}/stops/${stopId}`, error.message);
  await supabase.from("routes").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", routeId).eq("status", "planned");
  done(`/routes/${routeId}/stops/${stopId}`, "Arrived. Work the checklist, then report.");
}

export async function completeStop(fd: FormData) {
  const { supabase } = await requireUser();
  const routeId = str(fd, "route_id"); const stopId = str(fd, "stop_id");
  const back = `/routes/${routeId}/stops/${stopId}`;
  const outcome = str(fd, "outcome");
  if (!outcome) fail(back, "Pick an outcome.");
  const { data: openReq } = await supabase.from("route_tasks").select("id").eq("stop_id", stopId).eq("required", true).eq("done", false);
  if (openReq && openReq.length > 0) fail(back, "Tick the required checklist items first.");
  const materials: Record<string, number> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith("mat_") && Number(v) > 0) materials[k.slice(4)] = Number(v);
  const { data: stop } = await supabase.from("stops").select("arrived_at").eq("id", stopId).single();
  const now = new Date();
  const duration = stop?.arrived_at ? Math.max(1, Math.round((now.getTime() - new Date(stop.arrived_at).getTime()) / 60000)) : null;
  const followUp = str(fd, "follow_up_date") || null;
  const { error } = await supabase.from("stops").update({
    outcome, materials_left: materials, poc_spoken_to: str(fd, "poc") || null,
    placement_verified: str(fd, "placement_verified") === "on", verification_note: str(fd, "verification_note") || null,
    notes: str(fd, "notes") || null, follow_up_needed: !!followUp || str(fd, "follow_up_needed") === "on", follow_up_date: followUp,
    departed_at: now.toISOString(), completed_at: now.toISOString(), duration_min: duration,
    arrived_at: stop?.arrived_at ?? now.toISOString(), visit_type: str(fd, "visit_type") || "restock",
  }).eq("id", stopId);
  if (error) fail(back, error.message);
  // First visit on a prospect that went well: mark it active so it enters the visit cadence.
  if (["materials_placed", "restocked"].includes(outcome)) {
    const bid = str(fd, "business_id");
    await supabase.from("businesses").update({ status: "active" }).eq("id", bid).eq("status", "prospect");
  }
  revalidatePath(`/routes/${routeId}`);
  redirect(`/routes/${routeId}?ok=${encodeURIComponent("Stop reported")}`);
}

export async function reopenStop(fd: FormData) {
  const { supabase, role } = await requireUser();
  const routeId = str(fd, "route_id"); const stopId = str(fd, "stop_id");
  if (!isManager(role)) fail(`/routes/${routeId}/stops/${stopId}`, "Managers only.");
  await supabase.from("stops").update({ completed_at: null, departed_at: null }).eq("id", stopId);
  done(`/routes/${routeId}/stops/${stopId}`, "Stop reopened for editing");
}

export async function saveStopNote(fd: FormData) {
  const { supabase } = await requireUser();
  const routeId = str(fd, "route_id"); const stopId = str(fd, "stop_id");
  await supabase.from("stops").update({ notes: str(fd, "notes") || null }).eq("id", stopId);
  done(`/routes/${routeId}/stops/${stopId}`, "Note saved");
}

export async function deletePhoto(fd: FormData) {
  const { supabase } = await requireUser();
  const back = str(fd, "back");
  const { data: p } = await supabase.from("stop_photos").select("storage_path").eq("id", str(fd, "photo_id")).single();
  if (p) {
    await supabase.storage.from("stop-photos").remove([p.storage_path]);
    await supabase.from("stop_photos").delete().eq("id", str(fd, "photo_id"));
  }
  done(back, "Photo removed");
}

/* ---------- routine route templates ---------- */
export async function saveTemplate(fd: FormData) {
  const { supabase, user, profile, role } = await requireUser();
  const id = str(fd, "template_id");
  let businessIds: string[] = [];
  try { businessIds = JSON.parse(str(fd, "stops") || "[]"); } catch {}
  const name = str(fd, "name");
  if (!name) fail(id ? `/routes/templates/${id}` : "/routes/templates/new", "Give the routine route a name.");
  const shared = isManager(role) && str(fd, "shared") === "on";
  const payload = { name, weekday: numOrNull(fd, "weekday"), cadence: str(fd, "cadence") || "weekly", notes: str(fd, "notes") || null, rep_id: shared ? null : (isManager(role) && str(fd, "rep_id") ? str(fd, "rep_id") : user.id), territory_id: profile.territory_id, created_by: user.id };
  let tid = id;
  if (id) {
    const { error } = await supabase.from("route_templates").update(payload).eq("id", id);
    if (error) fail(`/routes/templates/${id}`, error.message);
    await supabase.from("route_template_stops").delete().eq("template_id", id);
  } else {
    const { data, error } = await supabase.from("route_templates").insert(payload).select("id").single();
    if (error || !data) fail("/routes/templates/new", error?.message ?? "Could not save");
    tid = data.id;
  }
  if (businessIds.length) await supabase.from("route_template_stops").insert(businessIds.map((b, i) => ({ template_id: tid, business_id: b, seq: i + 1 })));
  revalidatePath("/routes/templates");
  redirect(`/routes/templates/${tid}?ok=${encodeURIComponent("Routine route saved")}`);
}

export async function deleteTemplate(fd: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("route_templates").delete().eq("id", str(fd, "template_id"));
  revalidatePath("/routes/templates");
  redirect(`/routes/templates?ok=${encodeURIComponent("Routine route deleted")}`);
}

/** Create today's route from a template in one tap. */
export async function startFromTemplate(fd: FormData) {
  const { supabase, user, profile } = await requireUser();
  const tid = str(fd, "template_id");
  const route_date = str(fd, "route_date") || new Date().toISOString().slice(0, 10);
  const { data: t } = await supabase.from("route_templates").select("*, stops:route_template_stops(business_id,seq,visit_type)").eq("id", tid).single();
  if (!t) fail("/routes/templates", "Template not found");
  const stops = [...(t.stops ?? [])].sort((a, b) => a.seq - b.seq);
  if (stops.length === 0) fail(`/routes/templates/${tid}`, "This routine route has no stops yet.");
  const { data: route, error } = await supabase.from("routes").insert({ route_date, rep_id: user.id, territory_id: profile.territory_id, status: "planned", planned_stops: stops.length, notes: `From routine route: ${t.name}`, created_by: user.id }).select("id").single();
  if (error || !route) fail(`/routes/templates/${tid}`, error?.message ?? "Could not create route");
  const { data: bizRows } = await supabase.from("businesses").select("id,business_type").in("id", stops.map((s) => s.business_id));
  const byId = new Map((bizRows ?? []).map((b) => [b.id, b]));
  const { data: inserted } = await supabase.from("stops").insert(stops.map((s, i) => ({ route_id: route.id, business_id: s.business_id, rep_id: user.id, seq: i + 1, visit_type: s.visit_type }))).select("id,business_id");
  await seedTasks(supabase, route.id, profile.territory_id, (inserted ?? []).map((s) => ({ id: s.id, business_type: byId.get(s.business_id)?.business_type })));
  revalidatePath("/routes");
  redirect(`/routes/${route.id}?ok=${encodeURIComponent("Route created from routine")}`);
}
