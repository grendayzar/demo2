"use server";
import { requireUser, isManager } from "@/lib/auth";
import { done, fail, str } from "@/lib/actions";

export async function setLeadStatus(fd: FormData) {
  const { supabase, role } = await requireUser();
  if (!isManager(role)) fail("/leads", "Managers only.");
  const { error } = await supabase.from("leads").update({ status: str(fd, "status") }).eq("id", str(fd, "id"));
  if (error) fail("/leads", error.message);
  done(str(fd, "back") || "/leads", "Lead updated");
}
