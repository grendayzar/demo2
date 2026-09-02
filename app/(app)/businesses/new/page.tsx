import Link from "next/link";
import { Suspense } from "react";
import { requireUser, isManager } from "@/lib/auth";
import { PageHead, Card, BackLink } from "@/components/ui";
import { Toast } from "@/components/shell/Toast";
import { GeoFields } from "@/components/routes/GeoButton";
import { createBusiness } from "../actions";
import { BUSINESS_TYPES, PLACEMENT_TYPES } from "@/lib/types";
import { usd } from "@/lib/format";

export const metadata = { title: "Sign up a business" };

export default async function NewBusinessPage() {
  const { supabase, profile, role } = await requireUser();
  const [{ data: presets }, { data: reps }] = await Promise.all([
    supabase.from("territory_rate_presets").select("*").eq("territory_id", profile.territory_id ?? "00000000-0000-0000-0000-000000000000"),
    isManager(role) ? supabase.from("profiles").select("id,full_name").eq("role", "rep").eq("is_active", true).order("full_name") : Promise.resolve({ data: null }),
  ]);
  const general = (presets ?? []).find((p) => p.business_type == null);
  const band = { min: Number(general?.monthly_min ?? 200), max: Number(general?.monthly_max ?? 1000), def: Number(general?.default_fee ?? 350) };
  const byType: Record<string, { monthly_min: number; monthly_max: number }> = Object.fromEntries((presets ?? []).filter((p) => p.business_type).map((p) => [p.business_type as string, p]));

  return (
    <div>
      <Suspense><Toast /></Suspense>
      <BackLink href="/businesses" label="Stops" />
      <PageHead title="Sign up a business" sub={isManager(role) ? "Adds the business as an eligible stop straight away." : "Submits the business for approval. You can still plan a first visit while it's pending."} />
      <form action={createBusiness} className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <Card title="Business">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="field !mb-0 sm:col-span-2"><span>Business name</span><input name="name" required placeholder="e.g. Supermercado La Bodega" /></label>
              <label className="field !mb-0"><span>Type</span><select name="business_type">{BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
              <label className="field !mb-0"><span>Language at the counter</span><select name="language" defaultValue="es"><option value="es">Spanish</option><option value="en">English</option><option value="both">Both</option></select></label>
              <label className="field !mb-0 sm:col-span-2"><span>Address</span><input name="address" placeholder="Street, suite" /></label>
              <label className="field !mb-0"><span>City</span><input name="city" list="cities" placeholder="City" /><datalist id="cities">{(profile.territory?.cities ?? []).map((c) => <option key={c} value={c} />)}</datalist></label>
              <label className="field !mb-0"><span>Phone</span><input name="phone" type="tel" inputMode="tel" /></label>
              <label className="field !mb-0"><span>Visit cadence</span><select name="cadence" defaultValue="monthly">{["weekly", "biweekly", "monthly", "quarterly", "on_request"].map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}</select></label>
              <label className="field !mb-0"><span>Estimated weekly footfall</span><input type="number" name="weekly_footfall" min={0} inputMode="numeric" placeholder="people per week" /></label>
              {reps && <label className="field !mb-0"><span>Assign to rep</span><select name="assigned_rep_id" defaultValue=""><option value="">Me</option>{reps.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}</select></label>}
              <label className="field !mb-0 sm:col-span-2"><span>Tags (comma separated)</span><input name="tags" placeholder="plaza, high-traffic, owner-friendly" /></label>
              <div className="sm:col-span-2"><span className="label">Placements agreed</span><div className="flex flex-wrap gap-1.5">{PLACEMENT_TYPES.map((p) => <label key={p} className="chip cursor-pointer has-[:checked]:border-brand has-[:checked]:bg-brand-tint has-[:checked]:text-tp"><input type="checkbox" name="placement_types" value={p} className="hidden" />{p}</label>)}</div></div>
              <label className="field !mb-0 sm:col-span-2"><span>Notes</span><textarea name="notes" placeholder="Where the material goes, best time to visit, who decides" /></label>
              <div className="sm:col-span-2"><GeoFields /></div>
            </div>
          </Card>
          <Card title="Point of contact">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="field !mb-0"><span>Name</span><input name="contact_name" placeholder="Owner or manager" /></label>
              <label className="field !mb-0"><span>Role</span><input name="contact_role" placeholder="Owner, manager…" /></label>
              <label className="field !mb-0"><span>Email</span><input name="contact_email" type="email" inputMode="email" placeholder="needed to send the contract" /></label>
              <label className="field !mb-0"><span>Phone</span><input name="contact_phone" type="tel" inputMode="tel" /></label>
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Rate & contract">
            <div className="callout mb-4">
              <b>Area band: {usd(band.min)} – {usd(band.max)}/month.</b> Suggested {usd(band.def)}. {general?.notes ?? ""}
              {Object.keys(byType).length > 0 && <div className="mt-2 text-[12px] text-ts">By type: {Object.entries(byType).map(([t, p]) => `${t} ${usd(Number(p.monthly_min))}–${usd(Number(p.monthly_max))}`).join(" · ")}</div>}
            </div>
            <label className="field"><span>Agreed monthly rate ($)</span><input type="number" name="agreed_monthly_fee" min={band.min} max={band.max} step={25} defaultValue={band.def} inputMode="numeric" /><span className="hint">Must be inside the area band. Anything else needs a manager's assessment.</span></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="field !mb-0"><span>Term (months)</span><input type="number" name="term_months" min={1} defaultValue={12} /></label>
              <label className="field !mb-0"><span>Start date</span><input type="date" name="start_date" /></label>
            </div>
            <label className="field mt-3"><span>Note for the office</span><textarea name="contract_notes" className="!min-h-[60px]" placeholder="Anything agreed verbally" /></label>
            <label className="flex items-center gap-2 text-[13.5px] font-semibold"><input type="checkbox" name="request_contract" defaultChecked className="w-4 h-4 accent-[var(--brand)]" /> Request the contract be emailed to the contact</label>
          </Card>
          <div className="flex justify-end gap-2">
            <Link href="/businesses" className="btn">Cancel</Link>
            <button className="btn btn-pri btn-lg">Sign up business</button>
          </div>
          <p className="text-[11.5px] text-tt">A QR lead form is created automatically for this store. Print it from the account page.</p>
        </div>
      </form>
    </div>
  );
}
