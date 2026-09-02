"use server";
import { requireAdmin } from "@/lib/auth";
import { done, fail, str, numOrNull, bool, list } from "@/lib/actions";
import { slugify } from "@/lib/format";

export async function saveSettings(fd: FormData) {
  const { supabase, user } = await requireAdmin();
  const leads = { inbox_email: str(fd, "inbox_email"), default_webhook_url: str(fd, "default_webhook_url"), default_tags: str(fd, "default_tags").split(",").map((t) => t.trim()).filter(Boolean), clickup_list_id: str(fd, "clickup_list_id") };
  const company = { name: str(fd, "company_name") || "Accident Professionals", phone: str(fd, "company_phone"), website: str(fd, "company_website"), contract_url: str(fd, "contract_url") };
  const { error } = await supabase.from("app_settings").upsert([{ key: "leads", value: leads, updated_by: user.id, updated_at: new Date().toISOString() }, { key: "company", value: company, updated_by: user.id, updated_at: new Date().toISOString() }]);
  if (error) fail("/admin?tab=settings", error.message);
  done("/admin?tab=settings", "Settings saved");
}

export async function saveTerritory(fd: FormData) {
  const { supabase } = await requireAdmin();
  const id = str(fd, "id");
  const row = { code: str(fd, "code"), name: str(fd, "name"), state: str(fd, "state") || "GA", cities: str(fd, "cities").split(",").map((c) => c.trim()).filter(Boolean), manager_id: str(fd, "manager_id") || null, mileage_rate: numOrNull(fd, "mileage_rate") ?? 0.7, center_lat: numOrNull(fd, "center_lat"), center_lng: numOrNull(fd, "center_lng") };
  if (!row.code || !row.name) fail("/admin?tab=territories", "Code and name are required.");
  const { error } = id ? await supabase.from("territories").update(row).eq("id", id) : await supabase.from("territories").insert(row);
  if (error) fail("/admin?tab=territories", error.message);
  done("/admin?tab=territories", "Territory saved");
}

export async function saveChecklist(fd: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = str(fd, "id");
  const items = str(fd, "items").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => ({ label: l.replace(/^\*\s*/, ""), required: l.startsWith("*") }));
  const row = { name: str(fd, "name"), scope: str(fd, "scope") || "stop_pre", territory_id: str(fd, "territory_id") || null, business_type: str(fd, "business_type") || null, items, is_active: bool(fd, "is_active"), created_by: user.id };
  if (!row.name || items.length === 0) fail("/admin?tab=checklists", "Name and at least one item are required.");
  const { error } = id ? await supabase.from("checklist_templates").update(row).eq("id", id) : await supabase.from("checklist_templates").insert(row);
  if (error) fail("/admin?tab=checklists", error.message);
  done("/admin?tab=checklists", "Checklist saved");
}

export async function deleteChecklist(fd: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("checklist_templates").delete().eq("id", str(fd, "id"));
  done("/admin?tab=checklists", "Checklist deleted");
}

export async function saveDocument(fd: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = str(fd, "id");
  const title = str(fd, "title");
  if (!title) fail("/admin?tab=docs", "Title is required.");
  const row = { title, slug: str(fd, "slug") || slugify(title), category: str(fd, "category") || "training", summary: str(fd, "summary") || null, body_md: str(fd, "body_md"), version: str(fd, "version") || "1.0", is_published: bool(fd, "is_published"), requires_ack: bool(fd, "requires_ack"), audience: list(fd, "audience").length ? list(fd, "audience") : ["rep", "territory_manager", "admin", "super_admin"], updated_by: user.id };
  const { error } = id ? await supabase.from("documents").update(row).eq("id", id) : await supabase.from("documents").insert({ ...row, created_by: user.id });
  if (error) fail("/admin?tab=docs", error.message);
  done("/admin?tab=docs", "Document saved");
}

export async function deleteDocument(fd: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("documents").delete().eq("id", str(fd, "id"));
  done("/admin?tab=docs", "Document deleted");
}

export async function saveTier(fd: FormData) {
  const { supabase } = await requireAdmin();
  const id = str(fd, "id");
  const row = { fee_min: numOrNull(fd, "fee_min") ?? 0, fee_max: numOrNull(fd, "fee_max") ?? 0, audience_min: numOrNull(fd, "audience_min") ?? 0, audience_max: numOrNull(fd, "audience_max"), is_active: bool(fd, "is_active") };
  const { error } = await supabase.from("rate_card_tiers").update(row).eq("id", id);
  if (error) fail("/admin?tab=rates", error.message);
  done("/admin?tab=rates", "Tier saved");
}
