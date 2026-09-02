/** Email via Resend's REST API. Without RESEND_API_KEY it logs instead of sending, so the app works in dev. */
export async function sendEmail(msg: { to: string | string[]; subject: string; html: string; text?: string; replyTo?: string }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Promo Routes <onboarding@resend.dev>";
  if (!key) {
    console.log(`[email:not-sent] to=${Array.isArray(msg.to) ? msg.to.join(",") : msg.to} subject="${msg.subject}"`);
    return { ok: false, id: null as string | null, error: "RESEND_API_KEY not set" };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text, reply_to: msg.replyTo }),
    });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, id: (j.id as string) ?? null, error: r.ok ? null : JSON.stringify(j) };
  } catch (e) {
    return { ok: false, id: null, error: String(e) };
  }
}

const esc = (s: string | null | undefined) => (s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

export function layout(title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:Montserrat,Arial,sans-serif;color:#141414">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e4e1">
    <div style="background:#000;padding:18px 24px;border-bottom:3px solid #ffbd15"><span style="color:#ffbd15;font-weight:800;font-size:16px;letter-spacing:.02em">ACCIDENT PROFESSIONALS</span></div>
    <div style="padding:24px"><h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>${bodyHtml}</div>
    <div style="padding:14px 24px;background:#fafaf9;color:#9a9995;font-size:11px">Sent by Promo Routes. Advertising placements only; this message contains no case or lead outcome information.</div>
  </div></body></html>`;
}

export function kvTable(rows: [string, string | null | undefined][]) {
  return `<table style="border-collapse:collapse;width:100%;font-size:14px">${rows.map(([k, v]) => `<tr><td style="padding:6px 0;color:#686867;width:40%">${esc(k)}</td><td style="padding:6px 0;font-weight:600">${esc(v) || "—"}</td></tr>`).join("")}</table>`;
}

export function leadEmail(p: { business: string; slug: string; name: string; phone?: string | null; email?: string | null; language: string; accidentDate?: string | null; message?: string | null; tags: string[]; territory?: string | null }) {
  const subject = `New lead · ${p.name} · ${p.business}`;
  const html = layout("New lead from a store QR form", kvTable([["Business", p.business], ["Territory", p.territory], ["Name", p.name], ["Phone", p.phone], ["Email", p.email], ["Preferred language", p.language], ["Accident date", p.accidentDate], ["Message", p.message], ["Tags", p.tags.join(", ")], ["Form", p.slug]]));
  const text = `New lead\nBusiness: ${p.business}\nName: ${p.name}\nPhone: ${p.phone ?? ""}\nEmail: ${p.email ?? ""}\nLanguage: ${p.language}\nAccident date: ${p.accidentDate ?? ""}\nMessage: ${p.message ?? ""}\nTags: ${p.tags.join(", ")}`;
  return { subject, html, text };
}

export function contractRequestEmail(p: { business: string; contact?: string | null; email: string; fee: number; rep: string; notes?: string | null; placements: string[]; url: string }) {
  const subject = `Contract request · ${p.business} · $${p.fee}/month`;
  const html = layout("A rep requested a placement contract", kvTable([["Business", p.business], ["Contact", p.contact], ["Send to", p.email], ["Agreed monthly rate", `$${p.fee}`], ["Placements", p.placements.join(", ")], ["Requested by", p.rep], ["Notes", p.notes]]) + `<p style="margin-top:16px"><a href="${esc(p.url)}" style="background:#ffbd15;color:#000;padding:10px 16px;border-radius:999px;font-weight:700;text-decoration:none">Open contract requests</a></p>`);
  return { subject, html };
}

export function contractToBusinessEmail(p: { business: string; contact?: string | null; fee: number; placements: string[]; term: number; start?: string | null; contractUrl?: string | null; rep: string; company: { name: string; phone?: string; website?: string } }) {
  const subject = `${p.company.name} · Placement agreement for ${p.business}`;
  const html = layout(`Placement agreement for ${p.business}`, `
    <p>Hi ${esc(p.contact || "there")},</p>
    <p>Thank you for welcoming ${esc(p.company.name)} into ${esc(p.business)}. As discussed with ${esc(p.rep)}, here is a summary of the advertising placement we agreed:</p>
    ${kvTable([["Monthly rate", `$${p.fee}`], ["Placements", p.placements.join(", ") || "As agreed on site"], ["Term", `${p.term} months`], ["Start", p.start]])}
    ${p.contractUrl ? `<p style="margin-top:16px"><a href="${esc(p.contractUrl)}" style="background:#ffbd15;color:#000;padding:10px 16px;border-radius:999px;font-weight:700;text-decoration:none">Review and sign the agreement</a></p>` : `<p style="margin-top:16px">The agreement document will follow from our office shortly.</p>`}
    <p style="color:#686867;font-size:13px">The fee pays for advertising space and audience. It is not tied to referrals or cases. Reply to this email with any questions${p.company.phone ? ` or call ${esc(p.company.phone)}` : ""}.</p>`);
  return { subject, html };
}
