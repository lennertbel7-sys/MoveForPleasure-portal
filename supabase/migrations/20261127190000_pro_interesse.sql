-- ===== Pro-interesse meten (nog zonder betalen) =====
-- Leden zien in de app wat Pro wordt en kunnen "Ik wil Pro" tikken, met de
-- extra's die ze het meest zouden gebruiken en of ze per maand of per jaar
-- zouden betalen. Zo weten we of Pro de moeite is vóór we betalingen bouwen.
create table public.pro_interesse (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  aangemaakt timestamptz not null default now(),
  functies text[] not null default '{}'
    check (functies <@ array['redder','herinneringen','groepjes','rapport','plannen','coach']::text[] and cardinality(functies) <= 6),
  periode text check (periode in ('maand', 'jaar', 'weet niet'))
);
comment on table public.pro_interesse is 'Wie interesse heeft in MoveForPleasure Pro (geen betaling, alleen interesse).';
alter table public.pro_interesse enable row level security;
create policy "eigen interesse lezen" on public.pro_interesse for select to authenticated using (user_id = (select auth.uid()));
create policy "eigen interesse toevoegen" on public.pro_interesse for insert to authenticated with check (user_id = (select auth.uid()));
create policy "eigen interesse wijzigen" on public.pro_interesse for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "eigen interesse intrekken" on public.pro_interesse for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.pro_interesse from anon, authenticated;
grant select, delete on public.pro_interesse to authenticated;
grant insert (functies, periode), update (functies, periode) on public.pro_interesse to authenticated;

-- Overzicht voor de admin: hoeveel interesse, welke extra's, maand of jaar
create or replace function public.admin_pro_interesse()
returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'geen toegang'; end if;
  return json_build_object(
    'totaal', (select count(*) from public.pro_interesse),
    'actieve_leden', (select count(distinct user_id) from public.gebruikersdata where bijgewerkt > now() - interval '30 days'),
    'functies', coalesce((select json_object_agg(f, n) from (
        select f, count(*) as n from public.pro_interesse, unnest(functies) f group by f) x), '{}'::json),
    'periode', coalesce((select json_object_agg(coalesce(periode, 'onbekend'), n) from (
        select periode, count(*) as n from public.pro_interesse group by periode) y), '{}'::json)
  );
end;
$$;
revoke all on function public.admin_pro_interesse() from public, anon;
grant execute on function public.admin_pro_interesse() to authenticated;
