"use client";
import { useMemo, useState } from "react";
import { PLACEMENT_TYPES, type RateCardTier, type RatePreset } from "@/lib/types";
import { usd } from "@/lib/format";

const WEIGHTS: Record<string, number> = { "Counter display": 1.0, "Window decal": 0.7, Poster: 0.5, "Flyer rack": 0.4, "A-frame": 0.8, "Business cards": 0.3, "Digital screen": 1.2, "Social post": 0.7 };

export function computeValue(input: { footfall: number; placements: string[]; exclusivity: string; visibility: number; community: number }, tiers: RateCardTier[], preset: RatePreset | null) {
  const footTiers = tiers.filter((t) => t.metric === "weekly_footfall" && t.is_active).sort((a, b) => a.audience_min - b.audience_min);
  const tier = footTiers.find((t) => input.footfall >= t.audience_min && (t.audience_max == null || input.footfall <= t.audience_max)) ?? footTiers[0];
  const coverage = Math.min(1, input.placements.reduce((a, p) => a + (WEIGHTS[p] ?? 0.4), 0) / 2.4);
  const score = (input.visibility / 5) * 0.4 + (input.community / 5) * 0.3 + coverage * 0.3;
  const exclMult = input.exclusivity === "full" ? 1.25 : input.exclusivity === "category" ? 1.1 : 1;
  const raw = tier ? (tier.fee_min + (tier.fee_max - tier.fee_min) * score) * exclMult : 0;
  const band = preset ? { min: Number(preset.monthly_min), max: Number(preset.monthly_max) } : { min: 200, max: 1000 };
  const clamped = Math.min(band.max, Math.max(band.min, raw));
  const rounded = Math.round(clamped / 25) * 25;
  return { tier, coverage, score, exclMult, raw, band, suggested: rounded, offBand: raw < band.min || raw > band.max };
}

export function ValueCalculator({ tiers, preset, initial, businessId, action, canSave }: { tiers: RateCardTier[]; preset: RatePreset | null; initial?: { footfall?: number | null; placements?: string[] }; businessId: string; action: (fd: FormData) => void; canSave: boolean }) {
  const [footfall, setFootfall] = useState(initial?.footfall ?? 800);
  const [placements, setPlacements] = useState<string[]>(initial?.placements ?? ["Counter display"]);
  const [exclusivity, setExclusivity] = useState("none");
  const [visibility, setVisibility] = useState(3);
  const [community, setCommunity] = useState(3);
  const r = useMemo(() => computeValue({ footfall, placements, exclusivity, visibility, community }, tiers, preset), [footfall, placements, exclusivity, visibility, community, tiers, preset]);

  return (
    <form action={action} className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <input type="hidden" name="business_id" value={businessId} />
      <input type="hidden" name="tier_code" value={r.tier?.code ?? ""} />
      <input type="hidden" name="suggested_fee" value={r.suggested} />
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="field !mb-0"><span>Weekly footfall (people)</span><input type="number" name="weekly_footfall" min={0} value={footfall} onChange={(e) => setFootfall(Number(e.target.value))} inputMode="numeric" /></label>
          <label className="field !mb-0"><span>Exclusivity</span>
            <select name="exclusivity" value={exclusivity} onChange={(e) => setExclusivity(e.target.value)}><option value="none">None</option><option value="category">Category (no other law ads)</option><option value="full">Full (only us)</option></select>
          </label>
        </div>
        <div>
          <span className="label">Placements</span>
          <div className="flex flex-wrap gap-1.5">
            {PLACEMENT_TYPES.map((p) => (
              <label key={p} className={`chip cursor-pointer ${placements.includes(p) ? "on" : ""}`}>
                <input type="checkbox" name="placement_types" value={p} className="hidden" checked={placements.includes(p)} onChange={(e) => setPlacements(e.target.checked ? [...placements, p] : placements.filter((x) => x !== p))} />{p}
              </label>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="field !mb-0"><span>Visibility of the placement · {visibility}/5</span><input type="range" name="visibility_score" min={1} max={5} value={visibility} onChange={(e) => setVisibility(Number(e.target.value))} className="w-full accent-[var(--brand)]" /><span className="hint">1 = tucked away, 5 = at the register, eye level</span></label>
          <label className="field !mb-0"><span>Community fit · {community}/5</span><input type="range" name="community_fit" min={1} max={5} value={community} onChange={(e) => setCommunity(Number(e.target.value))} className="w-full accent-[var(--brand)]" /><span className="hint">How closely the customers match who we serve</span></label>
        </div>
        <label className="field !mb-0"><span>Notes</span><textarea name="notes" placeholder="How you measured footfall, what the owner asked for" /></label>
      </div>
      <div className="card p-4 self-start">
        <div className="text-[11px] font-bold tracking-widest uppercase text-tt">Suggested monthly value</div>
        <div className="text-[34px] font-extrabold tabular mt-1">{usd(r.suggested)}</div>
        <div className="text-[12px] text-ts">Area band {usd(r.band.min)} – {usd(r.band.max)}{r.offBand ? " · raw figure was outside the band, clamped" : ""}</div>
        <dl className="kv mt-4 text-[12.5px]">
          <dt>Tier</dt><dd>{r.tier ? `${r.tier.code} · ${usd(r.tier.fee_min)}–${usd(r.tier.fee_max)}` : "—"}</dd>
          <dt>Score</dt><dd>{Math.round(r.score * 100)}%</dd>
          <dt>Coverage</dt><dd>{Math.round(r.coverage * 100)}%</dd>
          <dt>Exclusivity</dt><dd>×{r.exclMult}</dd>
          <dt>Unclamped</dt><dd>{usd(r.raw)}</dd>
        </dl>
        <p className="text-[11px] text-tt mt-3">Value is a function of audience and placement only. Nothing about leads or cases is an input.</p>
        {canSave && <button className="btn btn-pri btn-block mt-4">Save assessment</button>}
      </div>
    </form>
  );
}
