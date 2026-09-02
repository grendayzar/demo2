"use server";
import { requireManager } from "@/lib/auth";
import { done, fail, str, numOrNull } from "@/lib/actions";

export async function addTerritoryCost(fd: FormData) {
  const { supabase, profile, user } = await requireManager();
  const territory_id = str(fd, "territory_id") || profile.territory_id;
  const amount = numOrNull(fd, "amount");
  if (!territory_id || amount == null) fail("/territory", "Amount is required.");
  const { error } = await supabase.from("territory_costs").insert({ territory_id, period: str(fd, "period"), category: str(fd, "category") || "other", amount, note: str(fd, "note") || null, created_by: user.id });
  if (error) fail("/territory", error.message);
  done("/territory?tab=costs", "Cost recorded");
}

export async function savePreset(fd: FormData) {
  const { supabase, profile, user } = await requireManager();
  const territory_id = str(fd, "territory_id") || profile.territory_id;
  const min = numOrNull(fd, "monthly_min") ?? 200; const max = numOrNull(fd, "monthly_max") ?? 1000;
  if (max < min) fail("/territory?tab=rates", "Max must be at least min.");
  const row = { territory_id, business_type: str(fd, "business_type") || null, monthly_min: min, monthly_max: max, default_fee: numOrNull(fd, "default_fee"), notes: str(fd, "notes") || null, updated_by: user.id, updated_at: new Date().toISOString() };
  const id = str(fd, "id");
  const { error } = id ? await supabase.from("territory_rate_presets").update(row).eq("id", id) : await supabase.from("territory_rate_presets").insert(row);
  if (error) fail("/territory?tab=rates", error.message);
  done("/territory?tab=rates", "Rate band saved");
}

export async function deletePreset(fd: FormData) {
  const { supabase } = await requireManager();
  await supabase.from("territory_rate_presets").delete().eq("id", str(fd, "id"));
  done("/territory?tab=rates", "Rate band removed");
}
