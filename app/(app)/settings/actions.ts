"use server";
import { requireUser, isAdmin } from "@/lib/auth";
import { done, fail, str, bool } from "@/lib/actions";

export async function updateMyProfile(fd: FormData) {
  const { supabase, user } = await requireUser();
  const patch = { full_name: str(fd, "full_name") || undefined, phone: str(fd, "phone") || null, language: str(fd, "language") || "en", vehicle: str(fd, "vehicle") || null, emergency_contact: str(fd, "emergency_contact") || null, job_title: str(fd, "job_title") || null, bio: str(fd, "bio") || null, photo_url: str(fd, "photo_url") || null };
  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) fail("/settings", error.message);
  done("/settings", "Profile saved");
}

/** Super admin: role, territory, active flag. Admin: territory and notes only via RLS (super_admin write policy). */
export async function adminUpdateProfile(fd: FormData) {
  const { supabase, role } = await requireUser();
  const id = str(fd, "id");
  if (!isAdmin(role)) fail(`/directory/${id}`, "Admins only.");
  const patch: Record<string, unknown> = { territory_id: str(fd, "territory_id") || null, is_active: bool(fd, "is_active"), notes: str(fd, "notes") || null, job_title: str(fd, "job_title") || null, started_on: str(fd, "started_on") || null, payee_class: str(fd, "payee_class") || null };
  if (str(fd, "role")) patch.role = str(fd, "role");
  if (str(fd, "full_name")) patch.full_name = str(fd, "full_name");
  const { data, error } = await supabase.from("profiles").update(patch).eq("id", id).select("id");
  if (error) fail(`/directory/${id}`, error.message);
  if (!data || data.length === 0) fail(`/directory/${id}`, "Only a super admin can change roles, territory or activation.");
  done(`/directory/${id}`, "Profile updated");
}
