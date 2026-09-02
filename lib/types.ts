export type UserRole = "rep" | "territory_manager" | "admin" | "super_admin" | "business_viewer";
export type Lang = "en" | "es" | "both";
export type BusinessStatus = "prospect" | "active" | "paused" | "declined" | "ineligible" | "archived";
export type Eligibility = "eligible" | "pending_review" | "ineligible";
export type Cadence = "weekly" | "biweekly" | "monthly" | "quarterly" | "on_request";
export type RouteStatus = "draft" | "planned" | "in_progress" | "submitted" | "reviewed";
export type VisitType = "first_visit" | "restock" | "verification" | "content" | "followup";
export type StopOutcome =
  | "materials_placed" | "restocked" | "verified_only" | "poc_unavailable" | "refused"
  | "business_closed" | "relocated" | "wrong_address" | "appointment_needed";
export type Exclusivity = "none" | "category" | "full";

export interface Territory {
  id: string; code: string; name: string; state: string; cities: string[]; manager_id: string | null;
  mileage_rate: number; center_lat: number | null; center_lng: number | null;
}
export interface Profile {
  id: string; full_name: string; email: string | null; phone: string | null; role: UserRole; language: Lang;
  territory_id: string | null; is_active: boolean; photo_url: string | null; job_title: string | null; bio: string | null;
  vehicle: string | null; emergency_contact: string | null; started_on: string | null; notes: string | null;
  created_at: string; updated_at: string;
  territory?: Territory | null;
}
export interface Business {
  id: string; name: string; business_type: string; territory_id: string | null; city: string | null; address: string | null;
  lat: number | null; lng: number | null; phone: string | null; language: Lang; status: BusinessStatus; eligibility: Eligibility;
  ineligibility_reason: string | null; cadence: Cadence; assigned_rep_id: string | null; last_visit_at: string | null;
  next_visit_due: string | null; notes: string | null; needs_detail: boolean; source: string; tags: string[];
  weekly_footfall: number | null; placement_types: string[]; created_at: string; updated_at: string;
  submitted_by: string | null; approved_by: string | null; approved_at: string | null;
}
export interface Route {
  id: string; route_date: string; rep_id: string; territory_id: string | null; status: RouteStatus; planned_stops: number;
  materials_taken: Record<string, number>; started_at: string | null; ended_at: string | null; mileage: number | null;
  notes: string | null; interrupted: boolean; interruption_reason: string | null; interruption_note: string | null;
  odometer_start: number | null; odometer_end: number | null; created_at: string;
}
export interface Stop {
  id: string; route_id: string; business_id: string; rep_id: string; seq: number; visit_type: VisitType;
  arrived_at: string | null; departed_at: string | null; duration_min: number | null; outcome: StopOutcome | null;
  materials_left: Record<string, number>; poc_spoken_to: string | null; placement_verified: boolean | null;
  verification_note: string | null; lat: number | null; lng: number | null; notes: string | null;
  follow_up_needed: boolean; follow_up_date: string | null; completed_at: string | null; created_at: string;
  business?: Business;
}
export interface Material {
  id: string; name: string; kind: string; language: Lang; design_version: string | null; qty_on_hand: number;
  reorder_point: number; unit_cost: number | null; supplier: string | null; artwork_url: string | null; updated_at: string;
}
export interface RouteTask {
  id: string; route_id: string; stop_id: string | null; phase: "pre" | "post"; label: string; required: boolean;
  done: boolean; done_at: string | null; sort_order: number;
}
export interface ChecklistTemplate {
  id: string; name: string; scope: "route_pre" | "route_post" | "stop_pre" | "stop_post"; territory_id: string | null;
  business_type: string | null; items: { label: string; required?: boolean }[]; is_active: boolean;
}
export interface RateCardTier {
  id: string; code: string; name: string; metric: "weekly_footfall" | "vehicles_per_week" | "reach_engagement";
  audience_min: number; audience_max: number | null; fee_min: number; fee_max: number; exclusivity: Exclusivity;
  cadence: Cadence; evidence_required: string; sort_order: number; is_active: boolean;
}
export interface RatePreset {
  id: string; territory_id: string; business_type: string | null; monthly_min: number; monthly_max: number;
  default_fee: number | null; notes: string | null;
}
export interface LeadForm {
  id: string; business_id: string; slug: string; webhook_url: string | null; webhook_secret: string | null; tags: string[];
  notify_email: string | null; headline: string | null; intro: string | null; language: Lang; is_active: boolean;
}
export interface Lead {
  id: string; lead_form_id: string | null; business_id: string | null; full_name: string; phone: string | null; email: string | null;
  preferred_language: Lang; accident_date: string | null; message: string | null; consent: boolean; source: string; tags: string[];
  status: "new" | "contacted" | "qualified" | "closed" | "spam"; created_at: string;
}
export interface DocumentRow {
  id: string; slug: string; title: string; category: "compliance" | "training" | "policy" | "brand" | "faq"; summary: string | null;
  body_md: string; audience: UserRole[]; version: string; is_published: boolean; requires_ack: boolean; updated_at: string;
}

export const BUSINESS_TYPES = [
  "Super Mercado", "Tienda Hispana / Store", "Taller / Body Shop", "Insurance / Aseguranza", "Community Organization",
  "Comida / Food", "Hairdresser / Peluqueria", "Taxes / Impuestos", "Influencer", "Panaderia", "Laundry / Lavanderia",
  "Taxi", "Tow / Grua", "Church / Iglesia", "Other",
] as const;

export const PLACEMENT_TYPES = ["Counter display", "Window decal", "Poster", "Flyer rack", "A-frame", "Business cards", "Digital screen", "Social post"] as const;

export const OUTCOMES: { value: StopOutcome; label: string; good: boolean }[] = [
  { value: "materials_placed", label: "Materials placed", good: true },
  { value: "restocked", label: "Restocked", good: true },
  { value: "verified_only", label: "Verified only", good: true },
  { value: "poc_unavailable", label: "Contact unavailable", good: false },
  { value: "appointment_needed", label: "Appointment needed", good: false },
  { value: "refused", label: "Refused", good: false },
  { value: "business_closed", label: "Business closed", good: false },
  { value: "relocated", label: "Relocated", good: false },
  { value: "wrong_address", label: "Wrong address", good: false },
];

export const ROLE_LABEL: Record<UserRole, string> = {
  rep: "Rep", territory_manager: "Territory manager", admin: "Admin", super_admin: "Super admin", business_viewer: "Business viewer",
};
