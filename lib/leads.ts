import { createHmac, createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, leadEmail } from "@/lib/email";

export interface LeadInput { slug: string; full_name: string; phone?: string; email?: string; preferred_language?: string; accident_date?: string; message?: string; consent: boolean; utm?: Record<string, string>; source?: string }

export function hashIp(ip: string) {
  return createHash("sha256").update(`${ip}|${process.env.LEAD_WEBHOOK_SECRET ?? "promo-routes"}`).digest("hex").slice(0, 24);
}

/** Stores the lead and fans it out to the store's webhook and the inbox. Returns the lead id. */
export async function captureLead(input: LeadInput, meta: { ip: string; userAgent: string }) {
  const db = createAdminClient();
  const { data: form } = await db.from("lead_forms").select("*, business:businesses(id,name,city,business_type,territory_id,assigned_rep_id, territory:territories(code,name))").eq("slug", input.slug).eq("is_active", true).maybeSingle();
  if (!form) throw new Error("Unknown or inactive form");
  const { data: settings } = await db.from("app_settings").select("key,value").in("key", ["leads", "company"]);
  const leadSettings = (settings?.find((s) => s.key === "leads")?.value ?? {}) as { inbox_email?: string; default_webhook_url?: string; default_tags?: string[]; clickup_list_id?: string };

  const tags = Array.from(new Set([...(leadSettings.default_tags ?? []), ...(form.tags ?? []), `store:${form.slug}`, ...(form.business?.territory?.code ? [`territory:${form.business.territory.code}`] : []), ...(input.utm?.utm_campaign ? [`campaign:${input.utm.utm_campaign}`] : [])]));

  const { data: lead, error } = await db.from("leads").insert({
    lead_form_id: form.id, business_id: form.business_id, full_name: input.full_name, phone: input.phone || null, email: input.email || null,
    preferred_language: input.preferred_language === "en" ? "en" : "es", accident_date: input.accident_date || null, message: input.message || null,
    consent: !!input.consent, source: input.source || "qr", tags, utm: input.utm ?? {}, ip_hash: hashIp(meta.ip), user_agent: meta.userAgent.slice(0, 300),
  }).select("*").single();
  if (error || !lead) throw new Error(error?.message ?? "Could not store lead");

  const payload = {
    event: "lead.created",
    lead: { id: lead.id, name: lead.full_name, phone: lead.phone, email: lead.email, language: lead.preferred_language, accident_date: lead.accident_date, message: lead.message, consent: lead.consent, created_at: lead.created_at, utm: lead.utm },
    business: { id: form.business?.id, name: form.business?.name, city: form.business?.city, type: form.business?.business_type, territory: form.business?.territory?.code ?? null, slug: form.slug },
    tags,
    // ClickUp-friendly fields for a "create task" automation
    clickup: { name: `Lead · ${lead.full_name} · ${form.business?.name ?? form.slug}`, description: [`Phone: ${lead.phone ?? "-"}`, `Email: ${lead.email ?? "-"}`, `Language: ${lead.preferred_language}`, `Accident date: ${lead.accident_date ?? "-"}`, `Store: ${form.business?.name ?? form.slug}`, `Message: ${lead.message ?? "-"}`].join("\n"), tags, list_id: leadSettings.clickup_list_id ?? null },
  };

  const deliveries: Promise<unknown>[] = [];
  const targets = [form.webhook_url, leadSettings.default_webhook_url].filter((u): u is string => !!u && u.startsWith("http"));
  for (const url of Array.from(new Set(targets))) deliveries.push(deliverWebhook(db, lead.id, url, payload, form.webhook_secret || process.env.LEAD_WEBHOOK_SECRET || null));
  const inbox = form.notify_email || leadSettings.inbox_email || process.env.LEADS_INBOX_EMAIL;
  if (inbox) deliveries.push(deliverEmail(db, lead.id, inbox, payload, form));
  await Promise.allSettled(deliveries);
  return lead.id;
}

async function deliverWebhook(db: ReturnType<typeof createAdminClient>, leadId: string, url: string, payload: unknown, secret: string | null) {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "Content-Type": "application/json", "User-Agent": "PromoRoutes/1.0" };
  if (secret) headers["X-Signature"] = createHmac("sha256", secret).update(body).digest("hex");
  let code: number | null = null; let text = "";
  try {
    const r = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(8000) });
    code = r.status; text = (await r.text()).slice(0, 500);
  } catch (e) { text = String(e).slice(0, 500); }
  await db.from("lead_deliveries").insert({ lead_id: leadId, channel: "webhook", target: url, status: code && code < 300 ? "sent" : "failed", response_code: code, response_body: text, attempts: 1, sent_at: new Date().toISOString() });
}

async function deliverEmail(db: ReturnType<typeof createAdminClient>, leadId: string, to: string, payload: { lead: { name: string; phone: string | null; email: string | null; language: string; accident_date: string | null; message: string | null }; business: { name?: string; territory: string | null; slug: string }; tags: string[] }, form: { slug: string }) {
  const res = await sendEmail({ to, ...leadEmail({ business: payload.business.name ?? form.slug, slug: form.slug, name: payload.lead.name, phone: payload.lead.phone, email: payload.lead.email, language: payload.lead.language, accidentDate: payload.lead.accident_date, message: payload.lead.message, tags: payload.tags, territory: payload.business.territory }) });
  await db.from("lead_deliveries").insert({ lead_id: leadId, channel: "email", target: to, status: res.ok ? "sent" : "failed", response_body: res.error ?? res.id, attempts: 1, sent_at: new Date().toISOString() });
}
