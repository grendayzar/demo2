"use server";
import { requireUser, isAdmin, isManager } from "@/lib/auth";
import { done, fail, str, numOrNull } from "@/lib/actions";

export async function requestRestock(fd: FormData) {
  const { supabase, user } = await requireUser();
  const qty = numOrNull(fd, "quantity");
  if (!qty || qty <= 0) fail("/inventory?tab=request", "Enter a quantity.");
  const { error } = await supabase.from("restock_requests").insert({ requested_by: user.id, material_id: str(fd, "material_id") || null, business_id: str(fd, "business_id") || null, quantity: qty, urgency: str(fd, "urgency") || "routine", notes: str(fd, "notes") || null });
  if (error) fail("/inventory?tab=request", error.message);
  done("/inventory?tab=requests", "Request sent to the office");
}

export async function cancelRestock(fd: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("restock_requests").update({ status: "cancelled" }).eq("id", str(fd, "id"));
  done("/inventory?tab=requests", "Request cancelled");
}

export async function decideRestock(fd: FormData) {
  const { supabase, role } = await requireUser();
  if (!isAdmin(role)) fail("/inventory?tab=requests", "Admins only.");
  const id = str(fd, "id");
  const status = str(fd, "status");
  const patch: Record<string, unknown> = { status };
  if (status === "fulfilled") patch.fulfilled_at = new Date().toISOString();
  const { error } = await supabase.from("restock_requests").update(patch).eq("id", id);
  if (error) fail("/inventory?tab=requests", error.message);
  if (status === "fulfilled") {
    // Issuing stock to a rep leaves the office store. Record it so the ledger balances.
    const { data: r } = await supabase.from("restock_requests").select("material_id,quantity,requested_by").eq("id", id).single();
    if (r?.material_id) await supabase.from("inventory_movements").insert({ material_id: r.material_id, qty_delta: -r.quantity, reason: "kit_issue", note: `Restock request fulfilled`, actor_id: (await supabase.auth.getUser()).data.user!.id });
  }
  done("/inventory?tab=requests", `Request ${status}`);
}

/** Office top-up, correction or count. Admin only. */
export async function adjustStock(fd: FormData) {
  const { supabase, user, role } = await requireUser();
  if (!isAdmin(role)) fail("/inventory", "Admins only.");
  const material_id = str(fd, "material_id");
  const reason = str(fd, "reason") || "restock";
  let delta = numOrNull(fd, "qty") ?? 0;
  if (reason === "count") {
    const { data: m } = await supabase.from("materials").select("qty_on_hand").eq("id", material_id).single();
    delta = delta - Number(m?.qty_on_hand ?? 0);
  } else if (["damaged", "kit_issue"].includes(reason)) delta = -Math.abs(delta);
  if (!delta) fail("/inventory?tab=ledger", "Nothing to change.");
  const { error } = await supabase.from("inventory_movements").insert({ material_id, qty_delta: Math.round(delta), reason, note: str(fd, "note") || null, actor_id: user.id });
  if (error) fail("/inventory?tab=ledger", error.message);
  done("/inventory?tab=ledger", "Stock updated");
}

/** Rep reports damaged/lost items from their kit. */
export async function reportDamaged(fd: FormData) {
  const { supabase, user } = await requireUser();
  const qty = Math.abs(numOrNull(fd, "qty") ?? 0);
  if (!qty) fail("/inventory", "Enter a quantity.");
  const { error } = await supabase.from("inventory_movements").insert({ material_id: str(fd, "material_id"), qty_delta: -qty, reason: "damaged", note: str(fd, "note") || null, actor_id: user.id });
  if (error) fail("/inventory", error.message);
  done("/inventory?tab=ledger", "Recorded");
}

export async function saveMaterial(fd: FormData) {
  const { supabase, role } = await requireUser();
  if (!isAdmin(role)) fail("/inventory", "Admins only.");
  const id = str(fd, "id");
  const row = { name: str(fd, "name"), kind: str(fd, "kind") || "other", language: str(fd, "language") || "both", design_version: str(fd, "design_version") || null, reorder_point: numOrNull(fd, "reorder_point") ?? 0, unit_cost: numOrNull(fd, "unit_cost"), supplier: str(fd, "supplier") || null, artwork_url: str(fd, "artwork_url") || null };
  if (!row.name) fail("/inventory?tab=materials", "Name is required.");
  const { error } = id ? await supabase.from("materials").update(row).eq("id", id) : await supabase.from("materials").insert({ ...row, qty_on_hand: numOrNull(fd, "qty_on_hand") ?? 0 });
  if (error) fail("/inventory?tab=materials", error.message);
  done("/inventory?tab=materials", "Material saved");
}

export async function saveKit(fd: FormData) {
  const { supabase, role } = await requireUser();
  if (!isManager(role)) fail("/inventory?tab=kits", "Managers only.");
  const rep_id = str(fd, "rep_id");
  const contents: Record<string, number> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith("mat_") && Number(v) > 0) contents[k.slice(4)] = Number(v);
  const { error } = await supabase.from("rep_kits").upsert({ rep_id, contents, issued_at: new Date().toISOString(), last_reconciled_at: new Date().toISOString(), variance: 0, variance_note: str(fd, "note") || null }, { onConflict: "rep_id" });
  if (error) fail("/inventory?tab=kits", error.message);
  done("/inventory?tab=kits", "Kit saved");
}
