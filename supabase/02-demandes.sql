-- ============================================================
--  HodoPlanner · demandes de devis et liste d'attente
--  À coller dans Supabase → SQL Editor → New query → Run (une fois).
--  N'importe qui peut ENVOYER une demande ; seule Erika peut les LIRE.
-- ============================================================
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null default 'devis' check (kind in ('devis', 'attente')),
  firstname text check (char_length(firstname) <= 100),
  email text not null check (char_length(email) between 3 and 200),
  whatsapp text check (char_length(whatsapp) <= 50),
  destinations text check (char_length(destinations) <= 300),
  estimate text check (char_length(estimate) <= 100),
  summary text not null check (char_length(summary) <= 8000),   -- la demande en clair
  details jsonb not null default '{}',
  status text not null default 'nouveau' check (status in ('nouveau', 'répondu', 'client', 'archivé'))
);
create index if not exists requests_created_idx on public.requests (created_at desc);

alter table public.requests enable row level security;

drop policy if exists "demandes : tout le monde peut envoyer" on public.requests;
create policy "demandes : tout le monde peut envoyer" on public.requests
  for insert to anon, authenticated with check (status = 'nouveau');
drop policy if exists "demandes : Erika lit" on public.requests;
create policy "demandes : Erika lit" on public.requests
  for select using (public.is_admin());
drop policy if exists "demandes : Erika modifie" on public.requests;
create policy "demandes : Erika modifie" on public.requests
  for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "demandes : Erika supprime" on public.requests;
create policy "demandes : Erika supprime" on public.requests
  for delete using (public.is_admin());

grant insert on public.requests to anon, authenticated;
grant select, update, delete on public.requests to authenticated;
