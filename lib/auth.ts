import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";

export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, territory:territories(*)")
    .eq("id", user.id)
    .maybeSingle();
  return { user, profile: (profile as Profile | null) ?? null, supabase };
});

/** Signed in, profile exists and is active. Otherwise redirect. */
export async function requireUser() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.profile || !s.profile.is_active) redirect("/pending");
  return { user: s.user, profile: s.profile, supabase: s.supabase, role: s.profile.role as UserRole };
}

export function isManager(role: UserRole) {
  return role === "territory_manager" || role === "admin" || role === "super_admin";
}
export function isAdmin(role: UserRole) {
  return role === "admin" || role === "super_admin";
}
export async function requireManager() {
  const s = await requireUser();
  if (!isManager(s.role)) redirect("/dashboard");
  return s;
}
export async function requireAdmin() {
  const s = await requireUser();
  if (!isAdmin(s.role)) redirect("/dashboard");
  return s;
}
