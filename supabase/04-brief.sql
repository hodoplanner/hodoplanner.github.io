-- HodoPlanner · le voyageur valide son brief (et paie) dans l'app avant que je commence.
-- À coller dans Supabase → SQL Editor → Run, une seule fois.
-- AVANT : remplace TON_WEBHOOK_SECRET (en bas) par le même mot de passe que dans 03-notifications.sql.

-- 1. Ce que le voyage garde de la demande : prix, brief, note du voyageur, date de validation
alter table public.trips
  add column if not exists price text check (char_length(price) <= 100),
  add column if not exists brief jsonb not null default '{}',
  add column if not exists brief_note text check (char_length(brief_note) <= 2000),
  add column if not exists validated_at timestamptz;

-- nouvelle étape « validated » : brief validé, paiement attendu
alter table public.trips drop constraint if exists trips_status_check;
alter table public.trips add constraint trips_status_check
  check (status in ('brief', 'validated', 'paid', 'in_progress', 'delivered', 'done'));

-- 2. Le voyageur valide son brief (il ne peut rien modifier d'autre dans le voyage)
--    offert → recherches en cours tout de suite ; payant → en attente du paiement
create or replace function public.validate_brief(trip uuid, note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare st text; p text;
begin
  if auth.uid() is null or not (public.is_member(trip) or public.is_admin()) then raise exception 'Accès refusé'; end if;
  select status, price into st, p from public.trips where id = trip for update;
  if st is null then raise exception 'Voyage introuvable'; end if;
  if st <> 'brief' then return st; end if;
  st := case when coalesce(p, '') ~* 'offert' then 'in_progress' else 'validated' end;
  update public.trips set status = st, validated_at = now(), brief_note = left(nullif(trim(note), ''), 2000) where id = trip;
  return st;
end $$;
revoke execute on function public.validate_brief(uuid, text) from public, anon;
grant execute on function public.validate_brief(uuid, text) to authenticated;

-- 3. Un mail pour moi quand un brief est validé (même fonction que les nouvelles demandes)
create or replace function public.notify_brief_validated()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://twzpdtjsfxdkcgasiumc.supabase.co/functions/v1/notify-request',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hodo-secret', 'TON_WEBHOOK_SECRET'),
    body := jsonb_build_object('type', 'VALIDATED', 'table', 'trips', 'schema', 'public',
      'record', jsonb_build_object('id', new.id, 'code', new.code, 'title', new.title, 'travelers', new.travelers,
        'status', new.status, 'price', new.price, 'brief_note', new.brief_note))
  );
  return new;
end $$;
revoke execute on function public.notify_brief_validated() from public, anon, authenticated;
drop trigger if exists notify_brief_validated on public.trips;
create trigger notify_brief_validated after update of status on public.trips
  for each row when (old.status = 'brief' and new.status in ('validated', 'in_progress'))
  execute function public.notify_brief_validated();
