-- Foutmeldingen uit de app (monitoring): zo ziet de admin wanneer
-- de app ergens vastloopt. Iedereen mag een melding toevoegen,
-- alleen admins mogen ze lezen. Na 30 dagen automatisch gewist.
create table public.app_fouten (
  id bigint generated always as identity primary key,
  tijd timestamptz not null default now(),
  gebruiker_id uuid default auth.uid() references auth.users(id) on delete cascade,
  bericht text not null check (char_length(bericht) between 1 and 500),
  bron text check (char_length(bron) <= 300),
  versie text check (char_length(versie) <= 20),
  browser text check (char_length(browser) <= 200)
);
create index app_fouten_tijd on public.app_fouten (tijd desc);
create index app_fouten_gebruiker on public.app_fouten (gebruiker_id);
comment on table public.app_fouten is 'Technische foutmeldingen uit de app. Alleen admins lezen; na 30 dagen gewist.';

alter table public.app_fouten enable row level security;

create policy "iedereen meldt fouten" on public.app_fouten
  for insert to anon, authenticated
  with check (gebruiker_id is not distinct from (select auth.uid()));

create policy "admin leest fouten" on public.app_fouten
  for select to authenticated
  using ((select public.is_admin()));

revoke all on public.app_fouten from anon, authenticated;
grant insert (bericht, bron, versie, browser) on public.app_fouten to anon, authenticated;
grant select on public.app_fouten to authenticated;

-- Tegen overspoelen: max. 20 meldingen per uur per gebruiker
-- (en samen max. 300 per uur voor wie niet ingelogd is)
create or replace function public.app_fouten_limiet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.tijd := now();
  if new.gebruiker_id is not null then
    if (select count(*) from public.app_fouten where gebruiker_id = new.gebruiker_id and tijd > now() - interval '1 hour') >= 20 then
      return null; -- stil negeren
    end if;
  elsif (select count(*) from public.app_fouten where gebruiker_id is null and tijd > now() - interval '1 hour') >= 300 then
    return null;
  end if;
  return new;
end;
$$;
revoke execute on function public.app_fouten_limiet() from public, anon, authenticated;
create trigger app_fouten_limiet before insert on public.app_fouten
  for each row execute function public.app_fouten_limiet();

-- Elke nacht meldingen ouder dan 30 dagen wissen
select cron.schedule('app_fouten_opruimen', '15 3 * * *',
  $$ delete from public.app_fouten where tijd < now() - interval '30 days' $$);
