"use server";
import { requireUser } from "@/lib/auth";
import { done, fail, str } from "@/lib/actions";

export async function acknowledgeDoc(fd: FormData) {
  const { supabase, user } = await requireUser();
  const slug = str(fd, "slug");
  const { error } = await supabase.from("document_acks").upsert({ document_id: str(fd, "document_id"), profile_id: user.id, version: str(fd, "version"), acked_at: new Date().toISOString() }, { onConflict: "document_id,profile_id" });
  if (error) fail(`/docs/${slug}`, error.message);
  done(`/docs/${slug}`, "Acknowledged. Thank you.");
}
