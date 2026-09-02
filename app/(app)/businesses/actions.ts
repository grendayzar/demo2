"use server";
import { requireUser, isManager } from "@/lib/auth";
import { done, fail, str, numOrNull, list, bool } from "@/lib/actions";
import { slugify } from "@/lib/format";
import { sendEmail, contractRequestEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createBusiness(fd: FormData) {
  const { supabase, user, profile, role } = await requireUser();
  const name = str(fd, "name");
  if (!name) fail("/businesses/new", "Business name is required.");
  if (!profile.territory_id) fail("/businesses/new", "You need a territory before signing up businesses.");
  const manager = isManager(role);
  const row = {
    name, business_type: str(fd, "business_type") || "Other", territory_id: profile.territory_id, city: str(fd, "city") || null,
    address: str(fd, "address") || null, phone: str(fd, "phone") || null, language: str(fd, "language") || "es",
    cadence: str(fd, "cadence") || "monthly", notes: str(fd, "notes") || null, weekly_footfall: numOrNull(fd, "weekly_footfall"),
    placement_types: list(fd, "placement_types"), tags: str(fd, "tags") ? str(fd, "tags").split(",").map((t) => t.trim()).filter(Boolean) : [],
    lat: numOrNull(fd, "lat"), lng: numOrNull(fd, "lng"),
    status: "prospect", eligibility: manager ? "eligible" : "pending_review",
    assigned_rep_id: manager && str(fd, "assigned_rep_id") ? str(fd, "assigned_rep_id") : user.id, created_by: user.id, source: "app",
  };
  const { data: biz, error } = await supabase.from("businesses").insert(row).select("id").single();
  if (error || !biz) fail("/businesses/new", error?.message ?? "Could not save the business.");
  const contactName = str(fd, "contact_name");
  if (contactName || str(fd, "contact_email") || str(fd, "contact_phone")) {
    await supabase.from("business_contacts").insert({ business_id: biz.id, name: contactName || "Owner", contact_role: str(fd, "contact_role") || null, phone: str(fd, "contact_phone") || null, email: str(fd, "contact_email") || null, is_primary: true });
  }
  // QR lead form for the store, created straight away so the rep can leave the code on the first visit.
  const slug = `${slugify(name)}-${biz.id.slice(0, 4)}`;
  await supabase.from("lead_forms").insert({ business_id: biz.id, slug, language: row.language, tags: [slug], created_by: user.id });

  const fee = numOrNull(fd, "agreed_monthly_fee");
  if (bool(fd, "request_contract") && str(fd, "contact_email") && fee != null) {
    const { data: cr } = await supabase.from("contract_requests").insert({
      business_id: biz.id, requested_by: user.id, contact_name: contactName || null, contact_email: str(fd, "contact_email"), contact_phone: str(fd, "contact_phone") || null,
      agreed_monthly_fee: fee, placement_types: list(fd, "placement_types"), term_months: numOrNull(fd, "term_months") ?? 12, start_date: str(fd, "start_date") || null, notes: str(fd, "contract_notes") || null,
    }).select("id").single();
    if (cr) {
      const inbox = process.env.CONTRACTS_INBOX_EMAIL || process.env.LEADS_INBOX_EMAIL;
      if (inbox) await sendEmail({ to: inbox, ...contractRequestEmail({ business: name, contact: contactName, email: str(fd, "contact_email"), fee, rep: profile.full_name, notes: str(fd, "contract_notes"), placements: list(fd, "placement_types"), url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/contracts` }) });
    }
  }
  revalidatePath("/businesses");
  redirect(`/businesses/${biz.id}?ok=${encodeURIComponent(manager ? "Business added" : "Business submitted for approval")}`);
}

export async function updateBusiness(fd: FormData) {
  const { supabase, role } = await requireUser();
  const id = str(fd, "id");
  const patch: Record<string, unknown> = {
    name: str(fd, "name"), business_type: str(fd, "business_type"), city: str(fd, "city") || null, address: str(fd, "address") || null,
    phone: str(fd, "phone") || null, language: str(fd, "language") || "es", cadence: str(fd, "cadence") || "monthly", notes: str(fd, "notes") || null,
    weekly_footfall: numOrNull(fd, "weekly_footfall"), placement_types: list(fd, "placement_types"), lat: numOrNull(fd, "lat"), lng: numOrNull(fd, "lng"),
    tags: str(fd, "tags") ? str(fd, "tags").split(",").map((t) => t.trim()).filter(Boolean) : [], needs_detail: false,
  };
  if (isManager(role)) {
    if (str(fd, "status")) patch.status = str(fd, "status");
    if (str(fd, "assigned_rep_id")) patch.assigned_rep_id = str(fd, "assigned_rep_id");
  }
  const { error } = await supabase.from("businesses").update(patch).eq("id", id);
  if (error) fail(`/businesses/${id}?tab=edit`, error.message);
  done(`/businesses/${id}`, "Saved");
}

export async function decideBusiness(fd: FormData) {
  const { supabase, role } = await requireUser();
  const id = str(fd, "id");
  if (!isManager(role)) fail(`/businesses/${id}`, "Managers only.");
  const approve = str(fd, "decision") === "approve";
  const { error } = await supabase.from("businesses").update(approve ? { eligibility: "eligible" } : { eligibility: "ineligible", status: "ineligible", ineligibility_reason: str(fd, "reason") || "Declined by manager" }).eq("id", id);
  if (error) fail(`/businesses/${id}`, error.message);
  done(`/businesses/${id}`, approve ? "Business approved" : "Business marked ineligible");
}

export async function addContact(fd: FormData) {
  const { supabase } = await requireUser();
  const id = str(fd, "business_id");
  const { error } = await supabase.from("business_contacts").insert({ business_id: id, name: str(fd, "name") || "Contact", contact_role: str(fd, "contact_role") || null, phone: str(fd, "phone") || null, email: str(fd, "email") || null, is_primary: bool(fd, "is_primary") });
  if (error) fail(`/businesses/${id}`, error.message);
  done(`/businesses/${id}`, "Contact added");
}

export async function saveLeadForm(fd: FormData) {
  const { supabase, user } = await requireUser();
  const id = str(fd, "business_id");
  const back = `/businesses/${id}?tab=leads`;
  const tags = str(fd, "tags").split(",").map((t) => t.trim()).filter(Boolean);
  const payload = { webhook_url: str(fd, "webhook_url") || null, webhook_secret: str(fd, "webhook_secret") || null, tags, notify_email: str(fd, "notify_email") || null, headline: str(fd, "headline") || null, intro: str(fd, "intro") || null, language: str(fd, "language") || "es", is_active: bool(fd, "is_active") };
  const existing = str(fd, "lead_form_id");
  if (existing) {
    const { error } = await supabase.from("lead_forms").update(payload).eq("id", existing);
    if (error) fail(back, error.message);
  } else {
    const { data: b } = await supabase.from("businesses").select("name").eq("id", id).single();
    const slug = `${slugify(b?.name ?? "store")}-${id.slice(0, 4)}`;
    const { error } = await supabase.from("lead_forms").insert({ ...payload, business_id: id, slug, created_by: user.id, tags: tags.length ? tags : [slug] });
    if (error) fail(back, error.message);
  }
  done(back, "Lead form saved");
}

export async function saveAssessment(fd: FormData) {
  const { supabase, user, role } = await requireUser();
  const id = str(fd, "business_id");
  const back = `/businesses/${id}?tab=value`;
  if (!isManager(role)) fail(back, "Managers only.");
  const { error } = await supabase.from("business_assessments").insert({
    business_id: id, assessed_by: user.id, weekly_footfall: numOrNull(fd, "weekly_footfall"), vehicles_per_week: numOrNull(fd, "vehicles_per_week"),
    placement_types: list(fd, "placement_types"), exclusivity: str(fd, "exclusivity") || "none", visibility_score: numOrNull(fd, "visibility_score"),
    community_fit: numOrNull(fd, "community_fit"), tier_code: str(fd, "tier_code") || null, suggested_fee: numOrNull(fd, "suggested_fee"), notes: str(fd, "notes") || null,
  });
  if (error) fail(back, error.message);
  await supabase.from("businesses").update({ weekly_footfall: numOrNull(fd, "weekly_footfall"), placement_types: list(fd, "placement_types") }).eq("id", id);
  done(back, "Assessment saved");
}

export async function requestContract(fd: FormData) {
  const { supabase, user, profile } = await requireUser();
  const id = str(fd, "business_id");
  const back = `/businesses/${id}?tab=contracts`;
  const fee = numOrNull(fd, "agreed_monthly_fee");
  if (!str(fd, "contact_email")) fail(back, "A contact email is needed to send the contract.");
  if (fee == null) fail(back, "Set the agreed monthly rate.");
  const { data: b } = await supabase.from("businesses").select("name").eq("id", id).single();
  const { error } = await supabase.from("contract_requests").insert({
    business_id: id, requested_by: user.id, contact_name: str(fd, "contact_name") || null, contact_email: str(fd, "contact_email"), contact_phone: str(fd, "contact_phone") || null,
    agreed_monthly_fee: fee, placement_types: list(fd, "placement_types"), term_months: numOrNull(fd, "term_months") ?? 12, start_date: str(fd, "start_date") || null, notes: str(fd, "notes") || null,
  });
  if (error) fail(back, error.message);
  const inbox = process.env.CONTRACTS_INBOX_EMAIL || process.env.LEADS_INBOX_EMAIL;
  if (inbox) await sendEmail({ to: inbox, ...contractRequestEmail({ business: b?.name ?? "Business", contact: str(fd, "contact_name"), email: str(fd, "contact_email"), fee, rep: profile.full_name, notes: str(fd, "notes"), placements: list(fd, "placement_types"), url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/contracts` }) });
  done(back, "Contract requested. The office will email it.");
}
