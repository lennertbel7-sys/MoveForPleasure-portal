-- Wachtlijst voor MoveForPleasure
create table public.wachtlijst (
  id bigint generated always as identity primary key,
  email text not null unique
    check (char_length(email) <= 254 and email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  type_sporter text not null
    check (type_sporter in ('beginner', 'kracht', 'combi', 'cardio')),
  wens text check (char_length(wens) <= 500),
  bron text check (char_length(bron) <= 50),
  aangemaakt_op timestamptz not null default now()
);

comment on table public.wachtlijst is 'Inschrijvingen via de landingspagina. Bezoekers mogen alleen toevoegen.';

-- Row Level Security: zonder policy mag niemand iets
alter table public.wachtlijst enable row level security;

-- Bezoekers (anon) mogen alleen een nieuwe inschrijving toevoegen
create policy "Iedereen mag zich inschrijven"
  on public.wachtlijst for insert
  to anon, authenticated
  with check (true);

-- Rechten expliciet beperken tot INSERT
revoke all on public.wachtlijst from anon, authenticated;
grant insert (email, type_sporter, wens, bron) on public.wachtlijst to anon, authenticated;

-- Teller: geeft alleen het AANTAL terug, nooit e-mailadressen
create function public.wachtlijst_aantal()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) from public.wachtlijst;
$$;

revoke all on function public.wachtlijst_aantal() from public;
grant execute on function public.wachtlijst_aantal() to anon, authenticated;
