-- Promo Routes web app: schema additions on top of the existing promo_routes schema.
-- Adds checklists, inventory ledger, lead capture (per-store webhook + QR), contract requests,
-- area rate presets, routine route templates, documents, route expenses, territory costs,
-- business assessments and app settings. Every table has RLS; helpers auth_role(),
-- auth_territory(), is_admin(), can_see_money() come from the base schema.

-- ---------- small additions to existing tables ----------
alter table territories
  add column if not exists mileage_rate numeric not null default 0.70,
  add column if not exists center_lat numeric,
  add column if not exists center_lng numeric;

alter table profiles
  add column if not exists job_title text,
  add column if not exists bio text;

alter table businesses
  add column if not exists tags text[] not null default '{}',
  add column if not exists weekly_footfall integer,
  add column if not exists placement_types text[] not null default '{}';

-- Territory managers may build and edit stops on routes in their own territory.
drop policy if exists stops_tm_write on stops;
create policy stops_tm_write on stops for all
  using (auth_role() = 'territory_manager' and exists (select 1 from routes r where r.id = stops.route_id and r.territory_id = auth_territory()))
  with check (auth_role() = 'territory_manager' and exists (select 1 from routes r where r.id = stops.route_id and r.territory_id = auth_territory()));

drop policy if exists photos_tm_read on stop_photos;
create policy photos_tm_read on stop_photos for select
  using (auth_role() = 'territory_manager' and exists (
    select 1 from stops s join businesses b on b.id = s.business_id
    where s.id = stop_photos.stop_id and b.territory_id = auth_territory()));

-- Reps can update the stock request they raised while it is still open.
drop policy if exists restock_own_update on restock_requests;
create policy restock_own_update on restock_requests for update
  using (requested_by = auth.uid() and status = 'requested')
  with check (requested_by = auth.uid());

-- ---------- app settings ----------
create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;
create policy settings_read on app_settings for select using (can_see_money());
create policy settings_admin on app_settings for all using (is_admin()) with check (is_admin());

-- ---------- checklists ----------
create table if not exists checklist_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scope text not null check (scope in ('route_pre','route_post','stop_pre','stop_post')),
  territory_id uuid references territories(id) on delete cascade,
  business_type text,
  items jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
comment on table checklist_templates is 'Pre/post visit checklists. items = [{label, required}]. territory_id null = every territory.';
alter table checklist_templates enable row level security;
create policy checklists_read on checklist_templates for select using (auth_role() is not null);
create policy checklists_admin on checklist_templates for all using (is_admin()) with check (is_admin());
create policy checklists_tm on checklist_templates for all
  using (auth_role() = 'territory_manager' and territory_id = auth_territory())
  with check (auth_role() = 'territory_manager' and territory_id = auth_territory());

create table if not exists route_tasks (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id) on delete cascade,
  stop_id uuid references stops(id) on delete cascade,
  phase text not null check (phase in ('pre','post')),
  label text not null,
  required boolean not null default false,
  done boolean not null default false,
  done_at timestamptz,
  done_by uuid references profiles(id),
  sort_order integer not null default 0,
  source_template_id uuid references checklist_templates(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists route_tasks_route_idx on route_tasks(route_id);
create index if not exists route_tasks_stop_idx on route_tasks(stop_id);
alter table route_tasks enable row level security;
create policy route_tasks_rep on route_tasks for all
  using (exists (select 1 from routes r where r.id = route_tasks.route_id and r.rep_id = auth.uid()))
  with check (exists (select 1 from routes r where r.id = route_tasks.route_id and r.rep_id = auth.uid()));
create policy route_tasks_tm on route_tasks for all
  using (auth_role() = 'territory_manager' and exists (select 1 from routes r where r.id = route_tasks.route_id and r.territory_id = auth_territory()))
  with check (auth_role() = 'territory_manager' and exists (select 1 from routes r where r.id = route_tasks.route_id and r.territory_id = auth_territory()));
create policy route_tasks_admin on route_tasks for all using (is_admin()) with check (is_admin());

-- ---------- inventory ledger ----------
create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials(id) on delete cascade,
  qty_delta integer not null check (qty_delta <> 0),
  reason text not null check (reason in ('restock','adjustment','placed_at_stop','kit_issue','kit_return','damaged','count')),
  stop_id uuid references stops(id) on delete set null,
  route_id uuid references routes(id) on delete set null,
  business_id uuid references businesses(id) on delete set null,
  actor_id uuid not null default auth.uid() references profiles(id),
  note text,
  created_at timestamptz not null default now()
);
comment on table inventory_movements is 'Append-style stock ledger. materials.qty_on_hand is maintained by trigger from this table.';
create index if not exists inventory_movements_material_idx on inventory_movements(material_id, created_at desc);
alter table inventory_movements enable row level security;
create policy inv_read_staff on inventory_movements for select using (can_see_money());
create policy inv_read_own on inventory_movements for select using (actor_id = auth.uid());
create policy inv_insert_rep on inventory_movements for insert
  with check (actor_id = auth.uid() and reason in ('placed_at_stop','damaged','count') and auth_role() is not null);
create policy inv_admin on inventory_movements for all using (is_admin()) with check (is_admin());

create or replace function apply_inventory_movement()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update materials set qty_on_hand = qty_on_hand + new.qty_delta, updated_at = now() where id = new.material_id;
  return new;
end $$;
drop trigger if exists inventory_apply on inventory_movements;
create trigger inventory_apply after insert on inventory_movements for each row execute function apply_inventory_movement();

-- When a stop is completed, materials_left keyed by material id is written to the ledger once.
create or replace function ledger_from_stop()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare k text; v text; q int;
begin
  if new.completed_at is null or (tg_op = 'UPDATE' and old.completed_at is not null) then
    return new;
  end if;
  for k, v in select * from jsonb_each_text(coalesce(new.materials_left, '{}'::jsonb)) loop
    begin
      q := v::int;
    exception when others then q := 0; end;
    if q > 0 and k ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       and exists (select 1 from materials m where m.id = k::uuid) then
      insert into inventory_movements (material_id, qty_delta, reason, stop_id, route_id, business_id, actor_id, note)
      values (k::uuid, -q, 'placed_at_stop', new.id, new.route_id, new.business_id, coalesce(new.rep_id, auth.uid()), 'Left at stop');
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists stops_ledger on stops;
create trigger stops_ledger after insert or update on stops for each row execute function ledger_from_stop();

-- ---------- lead capture ----------
create table if not exists lead_forms (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references businesses(id) on delete cascade,
  slug text not null unique,
  webhook_url text,
  webhook_secret text,
  tags text[] not null default '{}',
  notify_email text,
  headline text,
  intro text,
  language lang not null default 'es',
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table lead_forms is 'One public form per store. slug goes on the QR code (/l/<slug>). Each store can have its own webhook and tags for ClickUp.';
alter table lead_forms enable row level security;
create policy lead_forms_admin on lead_forms for all using (is_admin()) with check (is_admin());
create policy lead_forms_tm on lead_forms for all
  using (auth_role() = 'territory_manager' and exists (select 1 from businesses b where b.id = lead_forms.business_id and b.territory_id = auth_territory()))
  with check (auth_role() = 'territory_manager' and exists (select 1 from businesses b where b.id = lead_forms.business_id and b.territory_id = auth_territory()));
create policy lead_forms_rep_read on lead_forms for select
  using (auth_role() = 'rep' and exists (select 1 from businesses b where b.id = lead_forms.business_id and (b.assigned_rep_id = auth.uid() or b.territory_id = auth_territory())));
create policy lead_forms_rep_insert on lead_forms for insert
  with check (auth_role() = 'rep' and exists (select 1 from businesses b where b.id = lead_forms.business_id and b.assigned_rep_id = auth.uid()));
drop trigger if exists touch_lead_forms on lead_forms;
create trigger touch_lead_forms before update on lead_forms for each row execute function touch_updated_at();

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  lead_form_id uuid references lead_forms(id) on delete set null,
  business_id uuid references businesses(id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  preferred_language lang not null default 'es',
  accident_date date,
  message text,
  consent boolean not null default false,
  source text not null default 'qr',
  tags text[] not null default '{}',
  utm jsonb not null default '{}'::jsonb,
  ip_hash text,
  user_agent text,
  status text not null default 'new' check (status in ('new','contacted','qualified','closed','spam')),
  created_at timestamptz not null default now()
);
comment on table leads is 'Inbound leads from store QR forms. Inserted by the API with the service role. Never joined to payments.';
create index if not exists leads_business_idx on leads(business_id, created_at desc);
alter table leads enable row level security;
create policy leads_admin on leads for all using (is_admin()) with check (is_admin());
create policy leads_tm on leads for select
  using (auth_role() = 'territory_manager' and exists (select 1 from businesses b where b.id = leads.business_id and b.territory_id = auth_territory()));
create policy leads_tm_update on leads for update
  using (auth_role() = 'territory_manager' and exists (select 1 from businesses b where b.id = leads.business_id and b.territory_id = auth_territory()))
  with check (auth_role() = 'territory_manager');

create table if not exists lead_deliveries (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  channel text not null check (channel in ('webhook','email')),
  target text,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  response_code integer,
  response_body text,
  attempts integer not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table lead_deliveries enable row level security;
create policy lead_deliveries_admin on lead_deliveries for all using (is_admin()) with check (is_admin());
create policy lead_deliveries_tm on lead_deliveries for select
  using (auth_role() = 'territory_manager' and exists (select 1 from leads l join businesses b on b.id = l.business_id where l.id = lead_deliveries.lead_id and b.territory_id = auth_territory()));

-- ---------- area rate presets and contract requests ----------
create table if not exists territory_rate_presets (
  id uuid primary key default gen_random_uuid(),
  territory_id uuid not null references territories(id) on delete cascade,
  business_type text,
  monthly_min numeric not null default 200 check (monthly_min >= 0),
  monthly_max numeric not null default 1000 check (monthly_max >= monthly_min),
  default_fee numeric,
  notes text,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);
create unique index if not exists territory_rate_presets_unique on territory_rate_presets(territory_id, coalesce(business_type, ''));
comment on table territory_rate_presets is 'What is agreed for the area: the band a rep may pre-set a monthly rate in. business_type null = whole territory.';
alter table territory_rate_presets enable row level security;
create policy presets_read on territory_rate_presets for select using (auth_role() is not null);
create policy presets_admin on territory_rate_presets for all using (is_admin()) with check (is_admin());
create policy presets_tm on territory_rate_presets for all
  using (auth_role() = 'territory_manager' and territory_id = auth_territory())
  with check (auth_role() = 'territory_manager' and territory_id = auth_territory());

create table if not exists contract_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  requested_by uuid not null default auth.uid() references profiles(id),
  contact_name text,
  contact_email text not null,
  contact_phone text,
  agreed_monthly_fee numeric not null check (agreed_monthly_fee >= 0),
  placement_types text[] not null default '{}',
  term_months integer not null default 12,
  start_date date,
  notes text,
  status text not null default 'requested' check (status in ('requested','sent','signed','declined','cancelled')),
  sent_at timestamptz,
  sent_to text,
  email_provider_id text,
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table contract_requests is 'A rep signs a new business up and asks for the contract to be emailed. The office sends it and marks it signed.';
alter table contract_requests enable row level security;
create policy contracts_admin on contract_requests for all using (is_admin()) with check (is_admin());
create policy contracts_tm on contract_requests for all
  using (auth_role() = 'territory_manager' and exists (select 1 from businesses b where b.id = contract_requests.business_id and b.territory_id = auth_territory()))
  with check (auth_role() = 'territory_manager' and exists (select 1 from businesses b where b.id = contract_requests.business_id and b.territory_id = auth_territory()));
create policy contracts_rep_insert on contract_requests for insert with check (requested_by = auth.uid());
create policy contracts_rep_read on contract_requests for select using (requested_by = auth.uid());
create policy contracts_rep_cancel on contract_requests for update
  using (requested_by = auth.uid() and status = 'requested') with check (requested_by = auth.uid());
drop trigger if exists touch_contracts on contract_requests;
create trigger touch_contracts before update on contract_requests for each row execute function touch_updated_at();
drop trigger if exists audit_contracts on contract_requests;
create trigger audit_contracts after insert or update or delete on contract_requests for each row execute function write_audit();

-- ---------- business assessments (monthly placement value) ----------
create table if not exists business_assessments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  assessed_by uuid not null default auth.uid() references profiles(id),
  weekly_footfall integer,
  vehicles_per_week integer,
  placement_types text[] not null default '{}',
  exclusivity exclusivity not null default 'none',
  visibility_score integer check (visibility_score between 1 and 5),
  community_fit integer check (community_fit between 1 and 5),
  tier_code text,
  suggested_fee numeric,
  notes text,
  created_at timestamptz not null default now()
);
comment on table business_assessments is 'Territory manager assessment of what a placement is worth per month. Inputs are audience and placement only.';
alter table business_assessments enable row level security;
create policy assess_read on business_assessments for select using (can_see_money());
create policy assess_admin on business_assessments for all using (is_admin()) with check (is_admin());
create policy assess_tm on business_assessments for all
  using (auth_role() = 'territory_manager' and exists (select 1 from businesses b where b.id = business_assessments.business_id and b.territory_id = auth_territory()))
  with check (auth_role() = 'territory_manager' and assessed_by = auth.uid());
drop trigger if exists assess_no_outcomes on business_assessments;
create trigger assess_no_outcomes before insert or update on business_assessments for each row execute function reject_outcome_data();
drop trigger if exists audit_assessments on business_assessments;
create trigger audit_assessments after insert or update or delete on business_assessments for each row execute function write_audit();

-- ---------- routine route templates ----------
create table if not exists route_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rep_id uuid references profiles(id) on delete set null,
  territory_id uuid not null references territories(id) on delete cascade,
  weekday integer check (weekday between 0 and 6),
  cadence text not null default 'weekly' check (cadence in ('weekly','biweekly','monthly','adhoc')),
  notes text,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
comment on table route_templates is 'Routine routes. rep_id null = shared in the territory.';
alter table route_templates enable row level security;
create policy rt_admin on route_templates for all using (is_admin()) with check (is_admin());
create policy rt_tm on route_templates for all
  using (auth_role() = 'territory_manager' and territory_id = auth_territory())
  with check (auth_role() = 'territory_manager' and territory_id = auth_territory());
create policy rt_rep_read on route_templates for select
  using (auth_role() = 'rep' and territory_id = auth_territory() and (rep_id is null or rep_id = auth.uid()));
create policy rt_rep_write on route_templates for all
  using (auth_role() = 'rep' and rep_id = auth.uid())
  with check (auth_role() = 'rep' and rep_id = auth.uid() and territory_id = auth_territory());

create table if not exists route_template_stops (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references route_templates(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  seq integer not null default 0,
  visit_type visit_type not null default 'restock'
);
alter table route_template_stops enable row level security;
create policy rts_all on route_template_stops for all
  using (exists (select 1 from route_templates t where t.id = route_template_stops.template_id))
  with check (exists (select 1 from route_templates t where t.id = route_template_stops.template_id
              and (is_admin() or (auth_role() = 'territory_manager' and t.territory_id = auth_territory()) or t.rep_id = auth.uid())));

-- ---------- documents (compliance manuals, training briefs) ----------
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null check (category in ('compliance','training','policy','brand','faq')),
  summary text,
  body_md text not null default '',
  audience user_role[] not null default '{rep,territory_manager,admin,super_admin}',
  version text not null default '1.0',
  is_published boolean not null default false,
  requires_ack boolean not null default false,
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table documents enable row level security;
create policy docs_read on documents for select
  using (is_admin() or (is_published and auth_role() = any(audience)));
create policy docs_admin on documents for all using (is_admin()) with check (is_admin());
drop trigger if exists touch_documents on documents;
create trigger touch_documents before update on documents for each row execute function touch_updated_at();

create table if not exists document_acks (
  document_id uuid not null references documents(id) on delete cascade,
  profile_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  version text not null,
  acked_at timestamptz not null default now(),
  primary key (document_id, profile_id)
);
alter table document_acks enable row level security;
create policy acks_self on document_acks for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy acks_staff_read on document_acks for select using (can_see_money());

-- ---------- route expenses and territory costs ----------
create table if not exists route_expenses (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id) on delete cascade,
  rep_id uuid not null default auth.uid() references profiles(id),
  kind text not null check (kind in ('fuel','parking','tolls','meals','materials','other')),
  amount numeric not null check (amount >= 0),
  receipt_path text,
  note text,
  incurred_at date not null default current_date,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table route_expenses enable row level security;
create policy expenses_rep on route_expenses for all
  using (rep_id = auth.uid()) with check (rep_id = auth.uid() and exists (select 1 from routes r where r.id = route_expenses.route_id and r.rep_id = auth.uid()));
create policy expenses_tm on route_expenses for all
  using (auth_role() = 'territory_manager' and exists (select 1 from routes r where r.id = route_expenses.route_id and r.territory_id = auth_territory()))
  with check (auth_role() = 'territory_manager' and exists (select 1 from routes r where r.id = route_expenses.route_id and r.territory_id = auth_territory()));
create policy expenses_admin on route_expenses for all using (is_admin()) with check (is_admin());

create table if not exists territory_costs (
  id uuid primary key default gen_random_uuid(),
  territory_id uuid not null references territories(id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  category text not null check (category in ('mileage','placement_fees','materials','expenses','other')),
  amount numeric not null check (amount >= 0),
  note text,
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
alter table territory_costs enable row level security;
create policy tcosts_read on territory_costs for select using (is_admin() or (auth_role() = 'territory_manager' and territory_id = auth_territory()));
create policy tcosts_admin on territory_costs for all using (is_admin()) with check (is_admin());
create policy tcosts_tm on territory_costs for all
  using (auth_role() = 'territory_manager' and territory_id = auth_territory())
  with check (auth_role() = 'territory_manager' and territory_id = auth_territory());

-- ---------- reporting view (runs as the caller, so RLS still applies) ----------
create or replace view v_route_summary with (security_invoker = true) as
select r.id, r.route_date, r.rep_id, r.territory_id, r.status, r.mileage, r.started_at, r.ended_at, r.interrupted,
       count(s.id) as stops_total,
       count(s.id) filter (where s.completed_at is not null) as stops_done,
       count(s.id) filter (where s.outcome in ('materials_placed','restocked','verified_only')) as stops_successful,
       coalesce((select sum(e.amount) from route_expenses e where e.route_id = r.id), 0) as expenses_total,
       coalesce(r.mileage, 0) * coalesce(t.mileage_rate, 0.70) as mileage_cost
from routes r
left join stops s on s.route_id = r.id
left join territories t on t.id = r.territory_id
group by r.id, t.mileage_rate;

-- ---------- seed: default checklists, presets, documents ----------
insert into checklist_templates (name, scope, items) values
 ('Before leaving (route)', 'route_pre', '[{"label":"Kit loaded: cards, flyers, decals, displays","required":true},{"label":"Odometer start recorded","required":true},{"label":"Phone charged, app signed in","required":false},{"label":"Checked weather and traffic for the area","required":false}]'),
 ('Back at base (route)', 'route_post', '[{"label":"Odometer end recorded","required":true},{"label":"Every stop has an outcome and a photo","required":true},{"label":"Unused materials counted back","required":false},{"label":"Expenses and receipts added","required":false}]'),
 ('Arriving at a stop', 'stop_pre', '[{"label":"Confirm the address and the business is open","required":true},{"label":"Greet the point of contact by name","required":false},{"label":"Check current placement is still up and clean","required":true}]'),
 ('Leaving a stop', 'stop_post', '[{"label":"Photo of the placement taken","required":true},{"label":"Materials left recorded","required":true},{"label":"Point of contact noted","required":false},{"label":"Follow-up date set if anything is pending","required":false}]')
on conflict do nothing;

insert into territory_rate_presets (territory_id, business_type, monthly_min, monthly_max, default_fee, notes)
select id, null, 200, 1000, 350, 'Default band for the area. Anything outside needs a manager.' from territories
on conflict do nothing;

insert into app_settings (key, value) values
 ('leads', '{"inbox_email":"","default_webhook_url":"","default_tags":["promo-routes","qr-lead"]}'),
 ('company', '{"name":"Accident Professionals","phone":"","website":"https://accidentprofessionals.com"}')
on conflict (key) do nothing;

insert into documents (slug, title, category, summary, version, is_published, requires_ack, body_md) values
 ('field-compliance-manual', 'Field Compliance Manual', 'compliance', 'What a rep may and may not say or do at a stop.', '1.0', true, true,
$md$# Field Compliance Manual

## Why this exists
Accident Professionals places advertising material in community businesses. We pay businesses for **advertising space and audience**, never for referrals, cases or leads. Keeping that line clear protects the business owner, the rep and the company.

## At every stop
1. Introduce yourself and the company. Wear the badge.
2. Ask before placing or moving any material.
3. Take a photo of the placement before you leave.
4. Record the point of contact you spoke to.

## Never
- Never promise a business owner money for sending people to us.
- Never discuss case outcomes, settlements or "how many people signed".
- Never collect personal details from an injured person on paper. Use the store QR form so consent is recorded.
- Never offer legal advice. Hand out the material and point to the phone number.

## Materials
Only current design versions may be placed. If a business has old material, replace it and log it as damaged/returned in the app.

## Photos
Photos are proof of placement. Include the material and enough of the premises to recognise the location. No photos of customers.
$md$),
 ('new-rep-training-brief', 'New Rep Training Brief', 'training', 'First two weeks in the field, step by step.', '1.0', true, false,
$md$# New Rep Training Brief

## Week 1
- Shadow a senior rep on two full routes.
- Learn the kit: what each material is for and where it works best.
- Practise the 60-second introduction in English and Spanish.

## Week 2
- Run a routine route with a manager on call.
- Sign up one new business using the app and request the contract.
- Complete a full stop report with photos for every stop.

## The app, in one minute
1. **Routes** builds today's plan from your assigned stops or a routine route.
2. **Start route** records the odometer and gives you the pre-visit checklist.
3. At each stop, **Arrive**, work the checklist, then **Complete** with outcome, materials, photo and note.
4. **End route** closes the day and asks for the odometer and expenses.

## Rate setting
The area band is shown when you sign a business up. Set a monthly rate inside the band. Anything outside is a manager decision.
$md$),
 ('vehicle-and-safety-policy', 'Vehicle and Safety Policy', 'policy', 'Driving, weather and personal safety rules.', '1.0', true, true,
$md$# Vehicle and Safety Policy

- Check the forecast in the app before leaving. Do not drive in severe weather warnings; mark the route as interrupted with reason *weather*.
- Record odometer start and end on every route. Mileage is reimbursed at the territory rate.
- Park legally. Parking tickets are not reimbursed.
- If a location feels unsafe, leave and log the stop as *appointment needed* with a note. Tell your manager.
- Report any vehicle incident the same day.
$md$)
on conflict (slug) do nothing;
