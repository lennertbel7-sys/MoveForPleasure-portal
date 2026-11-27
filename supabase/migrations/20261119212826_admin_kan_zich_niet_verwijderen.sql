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
  -- Beveiliging: een admin-account kan niet via de app gewist worden
  if exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'admin-account kan niet verwijderd worden';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.verwijder_mijn_account() from public, anon;
grant execute on function public.verwijder_mijn_account() to authenticated;
