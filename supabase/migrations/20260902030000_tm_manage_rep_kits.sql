-- Territory managers issue and reconcile kits for reps in their own territory.
drop policy if exists kits_tm_write on rep_kits;
create policy kits_tm_write on rep_kits for all
  using (auth_role() = 'territory_manager' and exists (select 1 from profiles p where p.id = rep_kits.rep_id and p.territory_id = auth_territory()))
  with check (auth_role() = 'territory_manager' and exists (select 1 from profiles p where p.id = rep_kits.rep_id and p.territory_id = auth_territory()));

-- Territory managers also record kit issues / returns for their reps in the ledger.
drop policy if exists inv_insert_tm on inventory_movements;
create policy inv_insert_tm on inventory_movements for insert
  with check (auth_role() = 'territory_manager' and actor_id = auth.uid() and reason in ('kit_issue','kit_return','damaged','count','placed_at_stop'));
