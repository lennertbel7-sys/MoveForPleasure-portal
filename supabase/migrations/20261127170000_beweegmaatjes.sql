-- ===== Beweegmaatjes: samen bewegen =====
-- Je nodigt iemand uit met een link. Accepteert die, dan zien jullie van
-- elkaar ALLEEN: voornaam, op welke dagen je deze week bewoog en je weekritme.
-- Niet wat je deed, niet je gewicht, niet je e-mail. Je kan elkaar een
-- aanmoediging sturen (👏 💪 🔥 🧡). Alles loopt via functies met eigen checks;
-- de tabellen zelf zijn voor gewone gebruikers dicht.

create table public.maatje_uitnodigingen (
  code text primary key default encode(extensions.gen_random_bytes(8), 'hex'),
  van uuid not null references auth.users(id) on delete cascade,
  aangemaakt timestamptz not null default now(),
  gebruikt_door uuid references auth.users(id) on delete set null,
  gebruikt_op timestamptz
);
create index maatje_uitnodigingen_van on public.maatje_uitnodigingen (van);

create table public.maatjes (
  a uuid not null references auth.users(id) on delete cascade,
  b uuid not null references auth.users(id) on delete cascade,
  sinds timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
create index maatjes_b on public.maatjes (b);

create table public.aanmoedigingen (
  id bigint generated always as identity primary key,
  van uuid not null references auth.users(id) on delete cascade,
  naar uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('👏', '💪', '🔥', '🧡')),
  tijd timestamptz not null default now(),
  gelezen boolean not null default false
);
create index aanmoedigingen_naar on public.aanmoedigingen (naar, gelezen);
create index aanmoedigingen_van on public.aanmoedigingen (van, tijd);

alter table public.maatje_uitnodigingen enable row level security;
alter table public.maatjes enable row level security;
alter table public.aanmoedigingen enable row level security;
revoke all on public.maatje_uitnodigingen, public.maatjes, public.aanmoedigingen from anon, authenticated;

-- Hulpfunctie: zijn twee leden maatjes?
create or replace function public.zijn_maatjes(x uuid, y uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.maatjes where a = least(x, y) and b = greatest(x, y));
$$;
revoke all on function public.zijn_maatjes(uuid, uuid) from public, anon, authenticated;

-- Voornaam van een lid (zonder e-mail); leeg = "Je maatje"
create or replace function public.lid_naam(lid uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(btrim(g.waarde->>'naam'), ''), 'Je maatje')
  from (select 1) x left join public.gebruikersdata g on g.user_id = lid and g.sleutel = 'profiel';
$$;
revoke all on function public.lid_naam(uuid) from public, anon, authenticated;

-- 1. Uitnodiging maken (hergebruikt een recente ongebruikte)
create or replace function public.maatje_uitnodiging_maken()
returns text language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  if auth.uid() is null then raise exception 'niet ingelogd'; end if;
  select code into c from public.maatje_uitnodigingen
    where van = auth.uid() and gebruikt_door is null and aangemaakt > now() - interval '7 days'
    order by aangemaakt desc limit 1;
  if c is null then
    insert into public.maatje_uitnodigingen (van) values (auth.uid()) returning code into c;
  end if;
  return c;
end;
$$;

-- 2. Wie nodigt mij uit? (alleen voornaam, en of de link nog geldig is)
create or replace function public.maatje_uitnodiging_info(uitnodiging text)
returns json language plpgsql stable security definer set search_path = '' as $$
declare u record;
begin
  if auth.uid() is null then raise exception 'niet ingelogd'; end if;
  select * into u from public.maatje_uitnodigingen where code = uitnodiging;
  if not found then return json_build_object('geldig', false, 'reden', 'onbekend'); end if;
  if u.van = auth.uid() then return json_build_object('geldig', false, 'reden', 'eigen'); end if;
  if public.zijn_maatjes(u.van, auth.uid()) then return json_build_object('geldig', false, 'reden', 'al maatjes', 'naam', public.lid_naam(u.van)); end if;
  if u.gebruikt_door is not null or u.aangemaakt < now() - interval '14 days' then
    return json_build_object('geldig', false, 'reden', 'verlopen', 'naam', public.lid_naam(u.van));
  end if;
  return json_build_object('geldig', true, 'naam', public.lid_naam(u.van));
end;
$$;

-- 3. Uitnodiging aanvaarden
create or replace function public.maatje_accepteren(uitnodiging text)
returns json language plpgsql security definer set search_path = '' as $$
declare u record;
begin
  if auth.uid() is null then raise exception 'niet ingelogd'; end if;
  select * into u from public.maatje_uitnodigingen where code = uitnodiging for update;
  if not found or u.van = auth.uid() or u.gebruikt_door is not null or u.aangemaakt < now() - interval '14 days' then
    raise exception 'uitnodiging ongeldig';
  end if;
  if (select count(*) from public.maatjes where a = auth.uid() or b = auth.uid()) >= 10
     or (select count(*) from public.maatjes where a = u.van or b = u.van) >= 10 then
    raise exception 'te veel maatjes';
  end if;
  insert into public.maatjes (a, b) values (least(u.van, auth.uid()), greatest(u.van, auth.uid()))
    on conflict do nothing;
  update public.maatje_uitnodigingen set gebruikt_door = auth.uid(), gebruikt_op = now() where code = uitnodiging;
  return json_build_object('naam', public.lid_naam(u.van));
end;
$$;

-- 4. Mijn maatjes met hun week (alleen dagen + weekritme, geen details)
create or replace function public.mijn_maatjes()
returns table (maatje uuid, naam text, weekdoel int, dagen text[], aangemoedigd_vandaag int)
language plpgsql stable security definer set search_path = '' as $$
declare
  maandag date := date_trunc('week', (now() at time zone 'Europe/Brussels'))::date;
  vandaag date := (now() at time zone 'Europe/Brussels')::date;
begin
  if auth.uid() is null then raise exception 'niet ingelogd'; end if;
  return query
    with ander as (
      select case when m.a = auth.uid() then m.b else m.a end as id, m.sinds
      from public.maatjes m where m.a = auth.uid() or m.b = auth.uid()
    )
    select o.id,
           public.lid_naam(o.id),
           coalesce((select case when jsonb_typeof(g.waarde) = 'number' then (g.waarde)::text::int end
                     from public.gebruikersdata g where g.user_id = o.id and g.sleutel = 'weekdoel'), 3),
           coalesce((select array_agg(distinct e->>'datum' order by e->>'datum')
                     from public.gebruikersdata g, jsonb_array_elements(case when jsonb_typeof(g.waarde) = 'array' then g.waarde else '[]'::jsonb end) e
                     where g.user_id = o.id and g.sleutel in ('workouts', 'cardio')
                       and (e->>'datum') >= maandag::text and (e->>'datum') <= (maandag + 6)::text), '{}'),
           (select count(*)::int from public.aanmoedigingen x
             where x.van = auth.uid() and x.naar = o.id and (x.tijd at time zone 'Europe/Brussels')::date = vandaag)
    from ander o
    order by o.sinds;
end;
$$;

-- 5. Maatje stoppen
create or replace function public.maatje_verwijderen(maatje uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'niet ingelogd'; end if;
  delete from public.maatjes where a = least(maatje, auth.uid()) and b = greatest(maatje, auth.uid());
end;
$$;

-- 6. Aanmoediging sturen (max. 3 per maatje per dag)
create or replace function public.stuur_aanmoediging(naar uuid, emoji text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'niet ingelogd'; end if;
  if not public.zijn_maatjes(auth.uid(), naar) then raise exception 'geen maatjes'; end if;
  if (select count(*) from public.aanmoedigingen
      where van = auth.uid() and aanmoedigingen.naar = stuur_aanmoediging.naar and tijd > now() - interval '1 day') >= 3 then
    raise exception 'genoeg aangemoedigd';
  end if;
  insert into public.aanmoedigingen (van, naar, emoji) values (auth.uid(), naar, emoji);
end;
$$;

-- 7. Ontvangen aanmoedigingen (ongelezen) + gelezen zetten
create or replace function public.mijn_aanmoedigingen()
returns table (naam text, emoji text, tijd timestamptz)
language sql stable security definer set search_path = '' as $$
  select public.lid_naam(a.van), a.emoji, a.tijd
  from public.aanmoedigingen a
  where a.naar = auth.uid() and not a.gelezen and a.tijd > now() - interval '7 days'
    and public.zijn_maatjes(a.van, a.naar)
  order by a.tijd desc limit 10;
$$;

create or replace function public.aanmoedigingen_gelezen()
returns void language sql security definer set search_path = '' as $$
  update public.aanmoedigingen set gelezen = true where naar = auth.uid() and not gelezen;
$$;

-- Rechten: alleen ingelogde leden mogen deze functies gebruiken
revoke all on function public.maatje_uitnodiging_maken(), public.maatje_uitnodiging_info(text), public.maatje_accepteren(text),
  public.mijn_maatjes(), public.maatje_verwijderen(uuid), public.stuur_aanmoediging(uuid, text),
  public.mijn_aanmoedigingen(), public.aanmoedigingen_gelezen() from public, anon;
grant execute on function public.maatje_uitnodiging_maken(), public.maatje_uitnodiging_info(text), public.maatje_accepteren(text),
  public.mijn_maatjes(), public.maatje_verwijderen(uuid), public.stuur_aanmoediging(uuid, text),
  public.mijn_aanmoedigingen(), public.aanmoedigingen_gelezen() to authenticated;
