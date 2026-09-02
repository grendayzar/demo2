"use server";
import { requireUser, isManager } from "@/lib/auth";
import { done, fail, str } from "@/lib/actions";
import { sendEmail, contractToBusinessEmail } from "@/lib/email";

export async function sendContract(fd: FormData) {
  const { supabase, role, profile } = await requireUser();
  const id = str(fd, "id");
  if (!isManager(role)) fail("/contracts", "Managers only.");
  const { data: cr } = await supabase.from("contract_requests").select("*, business:businesses(name), rep:profiles!contract_requests_requested_by_fkey(full_name)").eq("id", id).single();
  if (!cr) fail("/contracts", "Request not found.");
  const { data: settings } = await supabase.from("app_settings").select("key,value").in("key", ["company"]);
  const company = (settings?.find((s) => s.key === "company")?.value ?? {}) as { name?: string; phone?: string; website?: string; contract_url?: string };
  const contractUrl = str(fd, "contract_url") || company.contract_url || null;
  const to = str(fd, "to") || cr.contact_email;
  const res = await sendEmail({ to, replyTo: profile.email ?? undefined, ...contractToBusinessEmail({ business: cr.business?.name ?? "your business", contact: cr.contact_name, fee: Number(cr.agreed_monthly_fee), placements: cr.placement_types ?? [], term: cr.term_months, start: cr.start_date, contractUrl, rep: cr.rep?.full_name ?? "our rep", company: { name: company.name ?? "Accident Professionals", phone: company.phone, website: company.website } }) });
  const { error } = await supabase.from("contract_requests").update({ status: "sent", sent_at: new Date().toISOString(), sent_to: to, email_provider_id: res.id }).eq("id", id);
  if (error) fail("/contracts", error.message);
  done("/contracts", res.ok ? `Contract emailed to ${to}` : `Marked as sent. Email not delivered: ${res.error ?? "no email provider configured"}`);
}

export async function setContractStatus(fd: FormData) {
  const { supabase, role, user } = await requireUser();
  const id = str(fd, "id");
  const status = str(fd, "status");
  const back = str(fd, "back") || "/contracts";
  const patch: Record<string, unknown> = { status };
  if (["signed", "declined"].includes(status)) { patch.decided_by = user.id; patch.decided_at = new Date().toISOString(); }
  if (status === "cancelled" && !isManager(role)) { /* rep cancelling own request; RLS enforces ownership */ }
  const { error } = await supabase.from("contract_requests").update(patch).eq("id", id);
  if (error) fail(back, error.message);
  if (status === "signed") {
    // A signed placement makes the business active with its agreed placements on file.
    const { data: cr } = await supabase.from("contract_requests").select("business_id,placement_types").eq("id", id).single();
    if (cr && isManager(role)) await supabase.from("businesses").update({ status: "active", eligibility: "eligible", placement_types: cr.placement_types }).eq("id", cr.business_id);
  }
  done(back, `Marked ${status}`);
}
