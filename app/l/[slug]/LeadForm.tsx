"use client";
import { useState } from "react";

const T = {
  es: { name: "Nombre completo", phone: "Teléfono", email: "Email (opcional)", lang: "Idioma preferido", date: "Fecha del accidente (opcional)", msg: "Cuéntanos brevemente qué pasó (opcional)", consent: "Acepto que me contacten sobre mi consulta.", send: "Quiero que me llamen", sending: "Enviando…", done: "¡Listo! Te llamamos muy pronto.", err: "No se pudo enviar. Intenta de nuevo." },
  en: { name: "Full name", phone: "Phone", email: "Email (optional)", lang: "Preferred language", date: "Date of accident (optional)", msg: "Briefly tell us what happened (optional)", consent: "I agree to be contacted about my enquiry.", send: "Request a call", sending: "Sending…", done: "Done! We'll call you shortly.", err: "Could not send. Please try again." },
};

export function LeadForm({ slug, lang, utm }: { slug: string; lang: "es" | "en"; utm: Record<string, string> }) {
  const t = T[lang];
  const [state, setState] = useState<"idle" | "busy" | "done" | "err">("idle");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("busy");
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(fd.entries());
    body.consent = fd.get("consent") === "on";
    Object.assign(body, utm);
    const r = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.ok) setState("done"); else { setErr(j.error || t.err); setState("err"); }
  }
  if (state === "done") return <div className="text-center py-6"><div className="text-[40px]">✅</div><p className="font-extrabold text-[18px] mt-2">{t.done}</p></div>;
  return (
    <form onSubmit={submit} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="preferred_language" value={lang} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label className="field !mb-0"><span>{t.name}</span><input name="full_name" required autoComplete="name" className="!bg-[#f5f5f4]" /></label>
      <label className="field !mb-0"><span>{t.phone}</span><input name="phone" type="tel" inputMode="tel" autoComplete="tel" required className="!bg-[#f5f5f4]" /></label>
      <label className="field !mb-0"><span>{t.email}</span><input name="email" type="email" inputMode="email" autoComplete="email" className="!bg-[#f5f5f4]" /></label>
      <label className="field !mb-0"><span>{t.date}</span><input name="accident_date" type="date" className="!bg-[#f5f5f4]" /></label>
      <label className="field !mb-0"><span>{t.msg}</span><textarea name="message" className="!bg-[#f5f5f4] !min-h-[70px]" /></label>
      <label className="flex items-start gap-2 text-[13px] font-semibold"><input type="checkbox" name="consent" required className="mt-0.5 w-4 h-4 accent-[var(--brand)]" /> {t.consent}</label>
      {state === "err" && <p className="text-bad text-[13px] font-semibold">{err}</p>}
      <button className="btn btn-pri btn-lg btn-block" disabled={state === "busy"}>{state === "busy" ? t.sending : t.send}</button>
    </form>
  );
}
