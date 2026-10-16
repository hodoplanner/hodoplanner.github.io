-- ============================================================
--  HodoPlanner · base de données (Supabase)
--  À coller tel quel dans Supabase → SQL Editor → New query → Run.
--  Le script peut être relancé sans risque : il ne supprime aucune donnée.
--
--  Principe de sécurité : chaque table est protégée (Row Level Security).
--   - un voyageur ne voit que les voyages dont il a entré le code ;
--   - Erika (profil is_admin) voit et modifie tout ;
--   - personne d'autre ne voit rien.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Profils (un par compte) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Crée le profil automatiquement à la première connexion
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------- Voyages ----------
-- Code lisible, sans caractères ambigus (0/O, 1/I/L)
create or replace function public.gen_trip_code()
returns text language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := 'HODO-';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.trips where code = c);
  end loop;
  return c;
end $$;

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  emoji text default '✈️',
  country text,                                   -- ex. JP
  start_date date,
  end_date date,
  travelers text[] not null default '{}',         -- prénoms affichés
  practical jsonb not null default '[]',          -- infos pratiques : [{title, text, source}]
  status text not null default 'brief'
    check (status in ('brief', 'paid', 'in_progress', 'delivered', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.trips alter column code set default public.gen_trip_code();

create table if not exists public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create or replace function public.is_member(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trip_members where trip_id = t and user_id = auth.uid());
$$;

-- Rejoindre un voyage avec son code (seule façon de devenir membre)
create or replace function public.join_trip(trip_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if auth.uid() is null then raise exception 'Connexion nécessaire'; end if;
  select id into t from public.trips where code = upper(trim(trip_code));
  if t is null then raise exception 'Code inconnu'; end if;
  insert into public.trip_members (trip_id, user_id) values (t, auth.uid())
  on conflict do nothing;
  return t;
end $$;

-- ---------- Ce qu'il faut réserver (préparé par Erika) ----------
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  type text not null default 'activity'
    check (type in ('flight', 'hotel', 'activity', 'transport', 'food', 'admin')),
  title text not null,
  where_label text,
  link text,
  date date,                 -- pour quel jour
  deadline date,             -- à réserver avant le
  rule text,                 -- règle HodoReminder (ex. ghibli-park) : l'ouverture se calcule
  price text,
  note text,                 -- le conseil d'Erika
  urgent boolean not null default false,
  partner boolean not null default false,   -- lien partenaire (affiché comme tel)
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists items_trip_idx on public.items (trip_id);

-- ---------- Ce que les voyageurs cochent ----------
create table if not exists public.item_progress (
  item_id uuid primary key references public.items (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  done boolean not null default false,
  ref text,                  -- n° de réservation (facultatif)
  paid text,                 -- prix payé (facultatif)
  mynote text,
  file_path text,            -- confirmation jointe (dossier privé)
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);
create index if not exists progress_trip_idx on public.item_progress (trip_id);

-- ---------- Programme jour par jour ----------
create table if not exists public.days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  date date not null,
  title text not null,
  subtitle text,
  icon text default 'star',
  color text default 'mint',
  base text,                 -- ville où l'on dort
  tip text,                  -- le conseil d'Erika
  stops jsonb not null default '[]',   -- [{when, name, text, tip, lat, lng, icon}]
  eat jsonb not null default '[]',     -- [{name, text, icon}]
  published boolean not null default false,  -- visible par les voyageurs seulement une fois validé
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists days_trip_idx on public.days (trip_id, date);

-- ---------- Dates de mise à jour automatiques ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

do $$ declare t text;
begin
  foreach t in array array['trips', 'items', 'item_progress', 'days'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- La progression doit concerner un élément du même voyage, et garder la trace de qui coche
create or replace function public.check_progress()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.items where id = new.item_id and trip_id = new.trip_id) then
    raise exception 'Élément inconnu pour ce voyage';
  end if;
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists check_progress on public.item_progress;
create trigger check_progress before insert or update on public.item_progress
  for each row execute function public.check_progress();

-- ============================================================
--  Sécurité (Row Level Security)
-- ============================================================
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.items enable row level security;
alter table public.item_progress enable row level security;
alter table public.days enable row level security;

drop policy if exists "profil : soi-même ou Erika" on public.profiles;
create policy "profil : soi-même ou Erika" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "voyages : membres et Erika" on public.trips;
create policy "voyages : membres et Erika" on public.trips
  for select using (public.is_admin() or public.is_member(id));
drop policy if exists "voyages : Erika modifie" on public.trips;
create policy "voyages : Erika modifie" on public.trips
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "membres : soi-même ou Erika" on public.trip_members;
create policy "membres : soi-même ou Erika" on public.trip_members
  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "membres : Erika gère" on public.trip_members;
create policy "membres : Erika gère" on public.trip_members
  for delete using (public.is_admin());

drop policy if exists "à réserver : membres et Erika" on public.items;
create policy "à réserver : membres et Erika" on public.items
  for select using (public.is_admin() or public.is_member(trip_id));
drop policy if exists "à réserver : Erika modifie" on public.items;
create policy "à réserver : Erika modifie" on public.items
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "progression : membres et Erika lisent" on public.item_progress;
create policy "progression : membres et Erika lisent" on public.item_progress
  for select using (public.is_admin() or public.is_member(trip_id));
drop policy if exists "progression : membres et Erika cochent" on public.item_progress;
create policy "progression : membres et Erika cochent" on public.item_progress
  for insert with check (public.is_admin() or public.is_member(trip_id));
drop policy if exists "progression : membres et Erika modifient" on public.item_progress;
create policy "progression : membres et Erika modifient" on public.item_progress
  for update using (public.is_admin() or public.is_member(trip_id))
  with check (public.is_admin() or public.is_member(trip_id));

drop policy if exists "jours : publiés pour les membres" on public.days;
create policy "jours : publiés pour les membres" on public.days
  for select using (public.is_admin() or (published and public.is_member(trip_id)));
drop policy if exists "jours : Erika modifie" on public.days;
create policy "jours : Erika modifie" on public.days
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
--  Autorisations (projet créé avec « Automatically expose new tables » désactivé :
--  rien n'est accessible sans ces lignes, et les règles ci-dessus filtrent ensuite ligne par ligne)
-- ============================================================
grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.trips, public.items, public.days to authenticated;
grant select, delete on public.trip_members to authenticated;
grant select, insert, update on public.item_progress to authenticated;
revoke all on public.profiles, public.trips, public.trip_members, public.items, public.item_progress, public.days from anon;

revoke execute on function public.join_trip(text) from public, anon;
grant execute on function public.join_trip(text) to authenticated;
grant execute on function public.is_admin(), public.is_member(uuid), public.gen_trip_code() to authenticated;

-- ============================================================
--  Fichiers : confirmations jointes (dossier privé, un sous-dossier par voyage)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('confirmations', 'confirmations', false)
on conflict (id) do nothing;

drop policy if exists "confirmations : membres et Erika lisent" on storage.objects;
create policy "confirmations : membres et Erika lisent" on storage.objects
  for select using (bucket_id = 'confirmations'
    and (public.is_admin() or public.is_member(((storage.foldername(name))[1])::uuid)));
drop policy if exists "confirmations : membres et Erika ajoutent" on storage.objects;
create policy "confirmations : membres et Erika ajoutent" on storage.objects
  for insert with check (bucket_id = 'confirmations'
    and (public.is_admin() or public.is_member(((storage.foldername(name))[1])::uuid)));
drop policy if exists "confirmations : membres et Erika remplacent" on storage.objects;
create policy "confirmations : membres et Erika remplacent" on storage.objects
  for update using (bucket_id = 'confirmations'
    and (public.is_admin() or public.is_member(((storage.foldername(name))[1])::uuid)));
drop policy if exists "confirmations : membres et Erika suppriment" on storage.objects;
create policy "confirmations : membres et Erika suppriment" on storage.objects
  for delete using (bucket_id = 'confirmations'
    and (public.is_admin() or public.is_member(((storage.foldername(name))[1])::uuid)));

-- ============================================================
--  Mises à jour en direct (les écrans se rafraîchissent tout seuls)
-- ============================================================
do $$ declare t text;
begin
  foreach t in array array['trips', 'items', 'item_progress', 'days'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ============================================================
--  À FAIRE UNE FOIS, après ta première connexion dans l'app :
--  remplace l'adresse ci-dessous par la tienne, puis lance seulement cette ligne.
--
--  update public.profiles set is_admin = true where email = 'ton-adresse@exemple.com';
-- ============================================================
