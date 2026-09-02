import { NextResponse } from "next/server";
import { captureLead } from "@/lib/leads";

export const runtime = "nodejs";
const hits = new Map<string, number[]>();

function limited(ip: string) {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 8;
}

/** Public endpoint behind the store QR forms. Accepts JSON or form posts. */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  if (limited(ip)) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  let body: Record<string, unknown> = {};
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) body = await req.json();
    else { const fd = await req.formData(); fd.forEach((v, k) => { body[k] = v.toString(); }); }
  } catch { return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 }); }

  if (body.website) return NextResponse.json({ ok: true }); // honeypot filled by a bot
  const slug = String(body.slug ?? "").trim();
  const full_name = String(body.full_name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email = String(body.email ?? "").trim();
  if (!slug || full_name.length < 2) return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
  if (!phone && !email) return NextResponse.json({ ok: false, error: "Phone or email is required" }, { status: 400 });
  if (!(body.consent === true || body.consent === "on" || body.consent === "true")) return NextResponse.json({ ok: false, error: "Consent is required" }, { status: 400 });
  const utm: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "ref"]) if (body[k]) utm[k] = String(body[k]).slice(0, 80);
  try {
    const id = await captureLead({ slug, full_name, phone, email, preferred_language: String(body.preferred_language ?? "es"), accident_date: String(body.accident_date ?? ""), message: String(body.message ?? "").slice(0, 2000), consent: true, utm, source: String(body.source ?? "qr") }, { ip, userAgent: req.headers.get("user-agent") ?? "" });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
