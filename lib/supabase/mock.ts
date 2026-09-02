/* Fixture-backed stand-in for the Supabase client, used only when SMOKE_MOCK=1 (scripts/smoke.mjs).
   It ignores filters and returns whole fixture tables so every page can be rendered without network. */
const T = "11111111-1111-4111-8111-000000000001";
const TERR = { id: T, code: "GA-NE", name: "Northeast Metro", state: "GA", cities: ["Norcross", "Doraville", "Chamblee", "Duluth"], manager_id: "00000000-0000-4000-8000-000000000001", mileage_rate: 0.7, center_lat: 33.94, center_lng: -84.21 };
const ME = { id: "00000000-0000-4000-8000-000000000001", territory: TERR, full_name: "Smoke Test", email: "smoke-test@promo-routes.local", phone: "404 555 0100", role: "super_admin", language: "en", territory_id: T, is_active: true, photo_url: null, job_title: "Territory manager", bio: null, vehicle: "2021 RAV4", emergency_contact: null, started_on: "2026-01-06", notes: null, created_at: "2026-01-06T00:00:00Z", updated_at: "2026-01-06T00:00:00Z", payee_class: null };
const REP = { id: "00000000-0000-4000-8000-000000000002", full_name: "Jonh Paul Jones", role: "rep", email: "jp@example.com", phone: null, photo_url: null, job_title: null, is_active: true, territory_id: T, territory: TERR, language: "es", created_at: "2026-02-01T00:00:00Z" };
const BIZ = [
  { id: "b1", name: "Supermercado La Bodega", business_type: "Super Mercado", territory_id: T, city: "Norcross", address: "5200 Buford Hwy", lat: 33.94, lng: -84.21, phone: "770 555 0101", language: "es", status: "active", eligibility: "eligible", cadence: "monthly", assigned_rep_id: REP.id, last_visit_at: "2026-08-20T15:00:00Z", next_visit_due: "2026-09-01", notes: "Counter display by the register.", needs_detail: false, source: "app", tags: ["plaza"], weekly_footfall: 1800, placement_types: ["Counter display", "Window decal"], created_at: "2026-03-01T00:00:00Z", updated_at: "2026-08-20T00:00:00Z", submitted_at: "2026-03-01T00:00:00Z", submitted_by: REP.id, approved_at: "2026-03-02T00:00:00Z", approved_by: ME.id, ineligibility_reason: null, rep: REP, territory: TERR },
  { id: "b2", name: "Taller Hermanos García", business_type: "Taller / Body Shop", territory_id: T, city: "Doraville", address: "3800 Shallowford Rd", lat: 33.91, lng: -84.28, phone: null, language: "es", status: "prospect", eligibility: "pending_review", cadence: "monthly", assigned_rep_id: REP.id, last_visit_at: null, next_visit_due: null, notes: null, needs_detail: true, source: "app", tags: [], weekly_footfall: null, placement_types: [], created_at: "2026-08-30T00:00:00Z", updated_at: "2026-08-30T00:00:00Z", submitted_at: "2026-08-30T00:00:00Z", submitted_by: REP.id, approved_at: null, approved_by: null, ineligibility_reason: null, rep: REP, territory: TERR },
  { id: "b3", name: "Panadería El Sol", business_type: "Panaderia", territory_id: T, city: "Chamblee", address: "2100 Chamblee Tucker Rd", lat: 33.89, lng: -84.29, phone: "770 555 0103", language: "both", status: "active", eligibility: "eligible", cadence: "biweekly", assigned_rep_id: REP.id, last_visit_at: "2026-08-25T14:00:00Z", next_visit_due: "2026-09-08", notes: null, needs_detail: false, source: "clickup_import", tags: [], weekly_footfall: 600, placement_types: ["Poster"], created_at: "2026-04-01T00:00:00Z", updated_at: "2026-08-25T00:00:00Z", submitted_at: null, submitted_by: null, approved_at: null, approved_by: null, ineligibility_reason: null, rep: REP, territory: TERR },
];
const ROUTE = { id: "r1", route_date: new Date().toISOString().slice(0, 10), rep_id: REP.id, territory_id: T, status: "in_progress", planned_stops: 2, materials_taken: { m1: 200 }, started_at: new Date(Date.now() - 3600000).toISOString(), ended_at: null, mileage: null, notes: null, interrupted: false, interruption_reason: null, interruption_note: null, odometer_start: 41200, odometer_end: null, created_at: new Date().toISOString(), rep: REP, territory: TERR, stops_total: 2, stops_done: 1, stops_successful: 1, expenses_total: 12.5, mileage_cost: 0 };
const STOPS = [
  { id: "s1", route_id: "r1", business_id: "b1", rep_id: REP.id, seq: 1, visit_type: "restock", arrived_at: new Date(Date.now() - 3000000).toISOString(), departed_at: new Date(Date.now() - 2400000).toISOString(), duration_min: 10, outcome: "restocked", materials_left: { m1: 25 }, poc_spoken_to: "Marta", placement_verified: true, verification_note: null, lat: 33.94, lng: -84.21, notes: "Owner happy, asked for Spanish flyers.", follow_up_needed: false, follow_up_date: null, completed_at: new Date(Date.now() - 2400000).toISOString(), created_at: new Date().toISOString(), business: BIZ[0], route: ROUTE, rep: REP, photos: [] },
  { id: "s2", route_id: "r1", business_id: "b2", rep_id: REP.id, seq: 2, visit_type: "first_visit", arrived_at: null, departed_at: null, duration_min: null, outcome: null, materials_left: {}, poc_spoken_to: null, placement_verified: null, verification_note: null, lat: null, lng: null, notes: null, follow_up_needed: false, follow_up_date: null, completed_at: null, created_at: new Date().toISOString(), business: BIZ[1], route: ROUTE, rep: REP, photos: [] },
];
const MATERIALS = [
  { id: "m1", name: "Business cards — Spanish", kind: "cards", language: "es", design_version: "v4.2", qty_on_hand: 8400, reorder_point: 2000, unit_cost: 0.06, supplier: "Norcross Print Co", artwork_url: null, updated_at: "2026-08-01T00:00:00Z" },
  { id: "m2", name: "Counter displays", kind: "display", language: "both", design_version: "v2.0", qty_on_hand: 18, reorder_point: 25, unit_cost: 11.5, supplier: "Atlanta Signworks", artwork_url: null, updated_at: "2026-08-01T00:00:00Z" },
  { id: "m3", name: "Flyers — Spanish", kind: "flyer", language: "es", design_version: "v3.1", qty_on_hand: 1650, reorder_point: 1200, unit_cost: 0.14, supplier: "Norcross Print Co", artwork_url: null, updated_at: "2026-08-01T00:00:00Z" },
];
const TASKS = [
  { id: "t1", route_id: "r1", stop_id: null, phase: "pre", label: "Kit loaded: cards, flyers, decals, displays", required: true, done: true, done_at: null, sort_order: 0 },
  { id: "t2", route_id: "r1", stop_id: null, phase: "pre", label: "Odometer start recorded", required: true, done: true, done_at: null, sort_order: 1 },
  { id: "t3", route_id: "r1", stop_id: null, phase: "post", label: "Odometer end recorded", required: true, done: false, done_at: null, sort_order: 0 },
  { id: "t4", route_id: "r1", stop_id: "s2", phase: "pre", label: "Confirm the address and the business is open", required: true, done: false, done_at: null, sort_order: 0 },
  { id: "t5", route_id: "r1", stop_id: "s2", phase: "post", label: "Photo of the placement taken", required: true, done: false, done_at: null, sort_order: 0 },
];
const DOCS = [
  { id: "d1", slug: "field-compliance-manual", title: "Field Compliance Manual", category: "compliance", summary: "What a rep may and may not say or do at a stop.", body_md: "# Field Compliance Manual\n\n## At every stop\n1. Introduce yourself.\n2. Ask before placing material.\n\n## Never\n- Never promise money for referrals.", audience: ["rep", "territory_manager", "admin", "super_admin"], version: "1.0", is_published: true, requires_ack: true, updated_at: "2026-09-01T00:00:00Z", created_at: "2026-09-01T00:00:00Z" },
  { id: "d2", slug: "new-rep-training-brief", title: "New Rep Training Brief", category: "training", summary: "First two weeks in the field.", body_md: "# Training", audience: ["rep"], version: "1.0", is_published: true, requires_ack: false, updated_at: "2026-09-01T00:00:00Z", created_at: "2026-09-01T00:00:00Z" },
];
const TABLES: Record<string, unknown[]> = {
  profiles: [ME, REP], territories: [TERR], businesses: BIZ, routes: [ROUTE], v_route_summary: [ROUTE], stops: STOPS, materials: MATERIALS, route_tasks: TASKS, documents: DOCS,
  document_acks: [], route_expenses: [{ id: "e1", route_id: "r1", rep_id: REP.id, kind: "fuel", amount: 12.5, note: "Shell on Buford Hwy", incurred_at: ROUTE.route_date, created_at: ROUTE.created_at }],
  stop_photos: [], business_contacts: [{ id: "c1", business_id: "b1", name: "Marta Reyes", contact_role: "Owner", phone: "770 555 0101", email: "marta@example.com", is_primary: true }],
  lead_forms: [{ id: "lf1", business_id: "b1", slug: "supermercado-la-bodega-b1", webhook_url: null, webhook_secret: null, tags: ["supermercado-la-bodega-b1"], notify_email: null, headline: null, intro: null, language: "es", is_active: true, business: { name: BIZ[0].name, city: "Norcross" } }],
  leads: [{ id: "l1", lead_form_id: "lf1", business_id: "b1", full_name: "Carlos Mendoza", phone: "678 555 0199", email: null, preferred_language: "es", accident_date: "2026-08-28", message: "Me chocaron en Buford Hwy.", consent: true, source: "qr", tags: ["promo-routes", "store:supermercado-la-bodega-b1"], status: "new", created_at: new Date().toISOString(), business: BIZ[0], deliveries: [{ channel: "email", status: "sent", target: "leads@x", response_code: null }] }],
  lead_deliveries: [], contract_requests: [{ id: "cr1", business_id: "b2", requested_by: REP.id, contact_name: "Luis García", contact_email: "luis@example.com", contact_phone: null, agreed_monthly_fee: 350, placement_types: ["Counter display"], term_months: 12, start_date: null, notes: null, status: "requested", sent_at: null, sent_to: null, created_at: new Date().toISOString(), business: BIZ[1], rep: REP }],
  rate_card_tiers: [{ id: "t1", code: "T2", name: "Tier 2 — Neighbourhood", metric: "weekly_footfall", audience_min: 500, audience_max: 1999, fee_min: 250, fee_max: 750, exclusivity: "none", cadence: "monthly", evidence_required: "", sort_order: 2, is_active: true }],
  territory_rate_presets: [{ id: "p1", territory_id: T, business_type: null, monthly_min: 200, monthly_max: 1000, default_fee: 350, notes: "Default band for the area." }],
  business_assessments: [], restock_requests: [{ id: "rr1", requested_by: REP.id, material_id: "m3", business_id: null, quantity: 500, urgency: "before_next_route", status: "requested", notes: null, requested_at: new Date().toISOString(), material: MATERIALS[2], rep: REP, business: null }],
  inventory_movements: [{ id: "im1", material_id: "m1", qty_delta: -25, reason: "placed_at_stop", stop_id: "s1", route_id: "r1", business_id: "b1", actor_id: REP.id, note: "Left at stop", created_at: new Date().toISOString(), material: MATERIALS[0], actor: REP, business: BIZ[0] }],
  rep_kits: [], checklist_templates: [{ id: "cl1", name: "Arriving at a stop", scope: "stop_pre", territory_id: null, business_type: null, items: [{ label: "Confirm the address", required: true }], is_active: true }],
  route_templates: [{ id: "rt1", name: "Buford Hwy Tuesdays", rep_id: REP.id, territory_id: T, weekday: 2, cadence: "weekly", notes: "Park behind the plaza.", is_active: true, stops: [{ id: "x", business_id: "b1", seq: 1 }, { id: "y", business_id: "b3", seq: 2 }], rep: REP }],
  route_template_stops: [], app_settings: [{ key: "leads", value: { inbox_email: "leads@example.com", default_webhook_url: "", default_tags: ["promo-routes"] } }, { key: "company", value: { name: "Accident Professionals", contract_url: "" } }],
  territory_costs: [], agreement_pricing: [], placement_agreements: [], audit_log: [], payment_runs: [],
};

function builder(table: string) {
  const rows = TABLES[table] ?? [];
  const result = { data: rows, error: null, count: rows.length };
  const p: Record<string, unknown> = {
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej),
    single: () => Promise.resolve({ data: rows[0] ?? null, error: rows[0] ? null : { message: "not found" } }),
    maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
  };
  return new Proxy(p, { get: (t, k) => (k in t ? t[k as string] : () => builder(table)) });
}

export function mockClient() {
  return {
    from: (table: string) => builder(table),
    auth: { getUser: async () => ({ data: { user: { id: ME.id, email: ME.email } }, error: null }), signOut: async () => ({ error: null }) },
    storage: { from: () => ({ createSignedUrls: async () => ({ data: [] }), createSignedUrl: async () => ({ data: null }), upload: async () => ({ error: null }), remove: async () => ({ error: null }) }) },
  };
}
