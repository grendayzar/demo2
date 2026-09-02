import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { LogoFull } from "@/components/brand/Logo";
import { LeadForm } from "./LeadForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `Accident Professionals · ${slug}`, robots: { index: false } };
}

export default async function PublicLeadPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string>> }) {
  const { slug } = await params;
  const sp = await searchParams;
  type FormRow = { slug: string; headline: string | null; intro: string | null; language: string; business: { name: string; city: string | null } | null };
  let form: FormRow | null = null;
  try {
    const db = createAdminClient();
    const { data } = await db.from("lead_forms").select("slug,headline,intro,language, business:businesses(name,city)").eq("slug", slug).eq("is_active", true).maybeSingle();
    form = data as unknown as FormRow | null;
  } catch { form = null; }
  if (!form) notFound();
  const es = form.language !== "en";
  const utm = Object.fromEntries(Object.entries(sp).filter(([k]) => k.startsWith("utm_") || k === "ref"));
  return (
    <main className="min-h-dvh bg-black text-white">
      <div className="max-w-[520px] mx-auto px-5 py-8">
        <LogoFull className="h-8 w-auto text-brand" />
        <h1 className="text-[28px] font-extrabold leading-tight mt-8">{form.headline || (es ? "¿Tuviste un accidente?" : "Been in an accident?")}</h1>
        <p className="text-[#a3a29d] mt-3 text-[15px] leading-relaxed">{form.intro || (es ? "Déjanos tus datos y un miembro de nuestro equipo te llama hoy mismo. Hablamos español. Sin costo, sin compromiso." : "Leave your details and a member of our team calls you today. Free, no obligation.")}</p>
        {form.business && <p className="text-[12px] text-[#686867] mt-2">{es ? "Aliado local" : "Local partner"}: {form.business.name}{form.business.city ? ` · ${form.business.city}` : ""}</p>}
        <div className="bg-white text-black rounded-2xl p-5 mt-6">
          <LeadForm slug={form.slug} lang={es ? "es" : "en"} utm={utm} />
        </div>
        <p className="text-[11px] text-[#686867] mt-6 leading-relaxed">{es ? "Al enviar aceptas que te contactemos por teléfono, SMS o email sobre tu consulta. No compartimos tus datos con el negocio donde escaneaste este código." : "By submitting you agree to be contacted by phone, SMS or email about your enquiry. Your details are not shared with the business where you scanned this code."}</p>
      </div>
    </main>
  );
}
