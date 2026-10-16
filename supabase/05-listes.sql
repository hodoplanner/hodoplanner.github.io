-- HodoPlanner · listes à cocher (checklist départ, valise, « À cocher » de chaque jour, plats à goûter…).
-- À coller dans Supabase → SQL Editor → Run, une seule fois (on peut le relancer sans risque).

-- 1. Chaque jour peut avoir sa petite liste « À cocher » (une ligne = une case)
alter table public.days add column if not exists checklist jsonb not null default '[]';

-- 2. Les cases cochées, partagées entre tous les voyageurs du voyage
--    key = « day:<id du jour>:<texte> » ou « info:<rubrique>:<texte> »
create table if not exists public.checks (
  trip_id uuid not null references public.trips (id) on delete cascade,
  key text not null check (char_length(key) <= 500),
  done boolean not null default true,
  updated_by uuid references auth.users (id) default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (trip_id, key)
);
alter table public.checks enable row level security;

drop policy if exists "cases : membres et Erika lisent" on public.checks;
create policy "cases : membres et Erika lisent" on public.checks
  for select using (public.is_admin() or public.is_member(trip_id));
drop policy if exists "cases : membres et Erika cochent" on public.checks;
create policy "cases : membres et Erika cochent" on public.checks
  for insert with check (public.is_admin() or public.is_member(trip_id));
drop policy if exists "cases : membres et Erika modifient" on public.checks;
create policy "cases : membres et Erika modifient" on public.checks
  for update using (public.is_admin() or public.is_member(trip_id))
  with check (public.is_admin() or public.is_member(trip_id));
drop policy if exists "cases : membres et Erika décochent" on public.checks;
create policy "cases : membres et Erika décochent" on public.checks
  for delete using (public.is_admin() or public.is_member(trip_id));

grant select, insert, update, delete on public.checks to authenticated;
revoke all on public.checks from anon;

drop trigger if exists touch_checks on public.checks;
create trigger touch_checks before update on public.checks for each row execute function public.touch_updated_at();

-- 3. Les autres voyageurs voient les cases se cocher en direct
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'checks') then
    alter publication supabase_realtime add table public.checks;
  end if;
end $$;
