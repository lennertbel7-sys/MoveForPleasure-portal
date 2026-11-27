-- Hulpfunctie: is de ingelogde gebruiker admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Eén gesprek per gebruiker met de admin. gebruiker_id = van wie het gesprek is.
create table public.chatberichten (
  id bigint generated always as identity primary key,
  gebruiker_id uuid not null references auth.users(id) on delete cascade,
  van_admin boolean not null default false,
  tekst text not null check (char_length(btrim(tekst)) between 1 and 2000),
  aangemaakt timestamptz not null default now(),
  gelezen boolean not null default false
);
create index chatberichten_gesprek on public.chatberichten (gebruiker_id, aangemaakt);
comment on table public.chatberichten is 'Chat tussen een gebruiker en de admin. Gebruiker ziet alleen zijn eigen gesprek; admin ziet alles.';

alter table public.chatberichten enable row level security;

create policy "eigen gesprek of admin lezen" on public.chatberichten
  for select to authenticated
  using (gebruiker_id = (select auth.uid()) or (select public.is_admin()));

create policy "gebruiker stuurt in eigen gesprek" on public.chatberichten
  for insert to authenticated
  with check (gebruiker_id = (select auth.uid()) and van_admin = false and gelezen = false);

create policy "admin antwoordt" on public.chatberichten
  for insert to authenticated
  with check ((select public.is_admin()) and van_admin = true and gelezen = false);

-- Anti-spam: max. 30 berichten per uur per gebruiker (admin onbeperkt)
create or replace function public.chat_limiet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.van_admin and (
    select count(*) from public.chatberichten
    where gebruiker_id = new.gebruiker_id and not van_admin and aangemaakt > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'te veel berichten';
  end if;
  return new;
end;
$$;
create trigger chat_limiet before insert on public.chatberichten
  for each row execute function public.chat_limiet();

-- Gelezen zetten: gebruiker leest antwoorden van admin; admin leest berichten van een gebruiker
create or replace function public.chat_gelezen(gesprek uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'niet ingelogd'; end if;
  if gesprek is not null then
    if not public.is_admin() then raise exception 'geen toegang'; end if;
    update public.chatberichten set gelezen = true
      where gebruiker_id = gesprek and not van_admin and not gelezen;
  else
    update public.chatberichten set gelezen = true
      where gebruiker_id = auth.uid() and van_admin and not gelezen;
  end if;
end;
$$;
revoke all on function public.chat_gelezen(uuid) from public, anon;
grant execute on function public.chat_gelezen(uuid) to authenticated;

-- Overzicht van alle gesprekken voor de admin (met e-mail en naam)
create or replace function public.admin_gesprekken()
returns table (gebruiker_id uuid, email text, naam text, laatste_tekst text, laatste_van_admin boolean, laatste_op timestamptz, ongelezen bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'geen toegang'; end if;
  return query
    select c.gebruiker_id,
           u.email::text,
           (select g.waarde->>'naam' from public.gebruikersdata g where g.user_id = c.gebruiker_id and g.sleutel = 'profiel'),
           l.tekst, l.van_admin, l.aangemaakt,
           count(*) filter (where not c.van_admin and not c.gelezen)
    from public.chatberichten c
    join auth.users u on u.id = c.gebruiker_id
    cross join lateral (
      select x.tekst, x.van_admin, x.aangemaakt from public.chatberichten x
      where x.gebruiker_id = c.gebruiker_id order by x.aangemaakt desc limit 1
    ) l
    group by c.gebruiker_id, u.email, l.tekst, l.van_admin, l.aangemaakt
    order by l.aangemaakt desc;
end;
$$;
revoke all on function public.admin_gesprekken() from public, anon;
grant execute on function public.admin_gesprekken() to authenticated;

-- Live updates (Realtime) voor nieuwe chatberichten
alter publication supabase_realtime add table public.chatberichten;
