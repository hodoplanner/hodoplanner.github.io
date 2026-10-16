-- ============================================================
--  HodoPlanner · mails automatiques à chaque nouvelle demande
--  (remplace le « Database Webhook » de l'interface Supabase)
--
--  AVANT DE LANCER : remplace TON_WEBHOOK_SECRET ci-dessous par la valeur
--  exacte de ton secret WEBHOOK_SECRET (Edge Functions → Secrets).
--  Puis : Supabase → SQL Editor → New query → coller → Run.
-- ============================================================
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_request()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  -- appelle la fonction notify-request, qui envoie les deux mails
  perform net.http_post(
    url := 'https://twzpdtjsfxdkcgasiumc.supabase.co/functions/v1/notify-request',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hodo-secret', 'TON_WEBHOOK_SECRET'),
    body := jsonb_build_object('type', 'INSERT', 'table', 'requests', 'schema', 'public', 'record', to_jsonb(new))
  );
  return new;
end $$;

-- personne d'autre ne peut appeler cette fonction directement
revoke execute on function public.notify_new_request() from public, anon, authenticated;

drop trigger if exists notify_new_request on public.requests;
create trigger notify_new_request after insert on public.requests
  for each row execute function public.notify_new_request();
