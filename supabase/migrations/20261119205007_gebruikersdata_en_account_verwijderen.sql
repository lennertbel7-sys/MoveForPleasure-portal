create table public.gebruikersdata (
  user_id uuid not null references auth.users(id) on delete cascade,
  sleutel text not null check (sleutel in ('workouts','cardio','schema','weekdoel','profiel','gewichten','badges-gezien','berichten-gelezen')),
  waarde jsonb not null,
  bijgewerkt timestamptz not null default now(),
  primary key (user_id, sleutel)
);
comment on table public.gebruikersdata is 'App-data per gebruiker: één rij per onderdeel (workouts, cardio, ...). Elke gebruiker ziet alleen zijn eigen rijen.';

alter table public.gebruikersdata enable row level security;

create policy "eigen data lezen" on public.gebruikersdata
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "eigen data toevoegen" on public.gebruikersdata
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "eigen data wijzigen" on public.gebruikersdata
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "eigen data verwijderen" on public.gebruikersdata
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Gebruiker kan zijn eigen account (en via cascade al zijn data) wissen (AVG-recht)
create or replace function public.verwijder_mijn_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'niet ingelogd';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.verwijder_mijn_account() from public, anon;
grant execute on function public.verwijder_mijn_account() to authenticated;
