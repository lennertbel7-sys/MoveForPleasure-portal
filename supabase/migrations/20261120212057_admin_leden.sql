-- Ledenlijst voor de adminpagina. Alleen admins krijgen antwoord.
create or replace function public.admin_leden()
returns table (
  gebruiker_id uuid, email text, naam text, doel text,
  aangemeld timestamptz, bevestigd boolean, laatst_ingelogd timestamptz,
  laatst_actief timestamptz, beweegmomenten int, is_admin boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'geen toegang'; end if;
  return query
    select u.id,
           u.email::text,
           (select g.waarde->>'naam' from public.gebruikersdata g where g.user_id = u.id and g.sleutel = 'profiel'),
           (select g.waarde->>'doel' from public.gebruikersdata g where g.user_id = u.id and g.sleutel = 'profiel'),
           u.created_at,
           u.email_confirmed_at is not null,
           u.last_sign_in_at,
           (select max(g.bijgewerkt) from public.gebruikersdata g where g.user_id = u.id),
           coalesce((select sum(case when jsonb_typeof(g.waarde) = 'array' then jsonb_array_length(g.waarde) else 0 end)::int
                     from public.gebruikersdata g where g.user_id = u.id and g.sleutel in ('workouts','cardio')), 0),
           exists (select 1 from public.admins a where a.user_id = u.id)
    from auth.users u
    order by u.created_at desc;
end;
$$;
revoke all on function public.admin_leden() from public, anon;
grant execute on function public.admin_leden() to authenticated;
