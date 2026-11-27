-- ===== Herinneringen: pushmeldingen + mail op geplande dagen =====

-- 1. Toestellen die pushmeldingen willen (één rij per toestel per lid)
create table public.push_abonnementen (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null check (char_length(endpoint) <= 1000 and endpoint like 'https://%'),
  aangemaakt timestamptz not null default now(),
  laatst_ok timestamptz,
  unique (user_id, endpoint)
);
comment on table public.push_abonnementen is 'Pushmeldingen: het adres van de pushdienst per toestel. Geen inhoud, geen sleutels van de gebruiker.';
alter table public.push_abonnementen enable row level security;
create policy "eigen toestellen lezen" on public.push_abonnementen
  for select to authenticated using (user_id = (select auth.uid()));
create policy "eigen toestel toevoegen" on public.push_abonnementen
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "eigen toestel verwijderen" on public.push_abonnementen
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_abonnementen from anon, authenticated;
grant select, delete on public.push_abonnementen to authenticated;
grant insert (endpoint) on public.push_abonnementen to authenticated;

-- 2. Wie kreeg vandaag al een herinnering? (max. één per dag; alleen de server)
create table public.herinnering_verstuurd (
  user_id uuid not null references auth.users(id) on delete cascade,
  datum date not null,
  kanaal text,
  verstuurd timestamptz not null default now(),
  primary key (user_id, datum)
);
alter table public.herinnering_verstuurd enable row level security;
revoke all on public.herinnering_verstuurd from anon, authenticated;
comment on table public.herinnering_verstuurd is 'Herinneringen: max. één per lid per dag. Alleen de server schrijft hierin.';

-- 3. VAPID-sleutels voor pushmeldingen, veilig in de Vault.
--    De Edge Function "herinnering" maakt ze de eerste keer zelf aan.
create or replace function public.vapid_publiek()
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'vapid_publiek' limit 1;
$$;
revoke all on function public.vapid_publiek() from public;
grant execute on function public.vapid_publiek() to anon, authenticated, service_role;

create or replace function public.vapid_prive()
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'vapid_prive' limit 1;
$$;
revoke all on function public.vapid_prive() from public, anon, authenticated;
grant execute on function public.vapid_prive() to service_role;

create or replace function public.vapid_bewaar(publiek text, prive text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from vault.secrets where name in ('vapid_publiek', 'vapid_prive')) then
    return false; -- al aanwezig: nooit overschrijven
  end if;
  perform vault.create_secret(publiek, 'vapid_publiek', 'Publieke VAPID-sleutel voor pushmeldingen');
  perform vault.create_secret(prive, 'vapid_prive', 'Geheime VAPID-sleutel voor pushmeldingen (JWK)');
  return true;
end;
$$;
revoke all on function public.vapid_bewaar(text, text) from public, anon, authenticated;
grant execute on function public.vapid_bewaar(text, text) to service_role;

-- 4. Planner: elk uur (op het hele uur) de functie "herinnering" aanroepen
select cron.schedule('herinneringen', '0 * * * *',
  $$ select net.http_post(
       url := 'https://wrwwwgquqaqnmphrhvyr.supabase.co/functions/v1/herinnering',
       body := '{}'::jsonb,
       headers := '{"Content-Type": "application/json"}'::jsonb,
       timeout_milliseconds := 60000
     ); $$);
