-- Pushmelding bij een aanmoediging van een beweegmaatje.
-- De pushmelding zelf blijft leeg (geen inhoud via Google/Apple). Elk toestel
-- krijgt een geheime "brievenbus"-sleutel; de server legt de tekst klaar en
-- de app op het toestel haalt die op zodra het seintje binnenkomt.

alter table public.push_abonnementen
  add column toestel_sleutel text unique check (toestel_sleutel ~ '^[0-9a-f]{32}$'),
  add column melding jsonb,
  add column melding_tijd timestamptz;
grant insert (endpoint, toestel_sleutel) on public.push_abonnementen to authenticated;

-- Het toestel haalt zijn melding op met zijn geheime sleutel (één keer, max. 1 uur oud)
create or replace function public.push_melding_ophalen(sleutel text)
returns json language plpgsql security definer set search_path = '' as $$
declare rij record;
begin
  select id, melding into rij from public.push_abonnementen
   where toestel_sleutel = sleutel and melding is not null and melding_tijd > now() - interval '1 hour'
   for update;
  if not found then return null; end if;
  update public.push_abonnementen set melding = null where id = rij.id;
  return rij.melding::json;
end;
$$;
revoke all on function public.push_melding_ophalen(text) from public;
grant execute on function public.push_melding_ophalen(text) to anon, authenticated;

-- Bij elke nieuwe aanmoediging de functie "herinnering" seinen
alter table public.aanmoedigingen add column gemeld boolean not null default false;

create or replace function public.aanmoediging_seinen()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://wrwwwgquqaqnmphrhvyr.supabase.co/functions/v1/herinnering',
    body := jsonb_build_object('aanmoediging', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
end;
$$;
revoke execute on function public.aanmoediging_seinen() from public, anon, authenticated;
create trigger aanmoediging_seinen after insert on public.aanmoedigingen
  for each row execute function public.aanmoediging_seinen();
