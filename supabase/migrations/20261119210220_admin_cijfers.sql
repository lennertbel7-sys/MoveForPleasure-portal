-- Kerncijfers voor de adminpagina. Alleen admins krijgen antwoord.
create or replace function public.admin_cijfers()
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'geen toegang';
  end if;
  return json_build_object(
    'gebruikers',  (select count(*) from auth.users),
    'bevestigd',   (select count(*) from auth.users where email_confirmed_at is not null),
    'nieuw_7d',    (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'actief_7d',   (select count(distinct user_id) from public.gebruikersdata where bijgewerkt > now() - interval '7 days'),
    'wachtlijst',  (select count(*) from public.wachtlijst)
  );
end;
$$;
revoke all on function public.admin_cijfers() from public, anon;
grant execute on function public.admin_cijfers() to authenticated;
