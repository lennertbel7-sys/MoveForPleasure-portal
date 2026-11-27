-- ===== Admins: wie mag berichten publiceren =====
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  aangemaakt_op timestamptz not null default now()
);
alter table public.admins enable row level security;

-- Een ingelogde gebruiker mag alleen zien of HIJZELF admin is
create policy "Eigen adminstatus zien"
  on public.admins for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;

-- ===== Berichten voor het berichtencentrum =====
create table public.berichten (
  id bigint generated always as identity primary key,
  titel text not null check (char_length(titel) between 1 and 120),
  tekst text not null check (char_length(tekst) between 1 and 2000),
  categorie text not null default 'motivatie'
    check (categorie in ('motivatie', 'weetje', 'tip', 'nieuws')),
  vastgepind boolean not null default false,
  zichtbaar boolean not null default true,
  gepubliceerd_op timestamptz not null default now(),
  auteur uuid default auth.uid() references auth.users (id) on delete set null,
  aangemaakt_op timestamptz not null default now()
);
create index berichten_gepubliceerd_op_idx on public.berichten (gepubliceerd_op desc);
create index berichten_auteur_idx on public.berichten (auteur);

comment on table public.berichten is 'Berichten van de admin die in het berichtencentrum van de app verschijnen.';

alter table public.berichten enable row level security;

-- Iedereen (ook zonder account) ziet gepubliceerde berichten
create policy "Iedereen leest gepubliceerde berichten"
  on public.berichten for select
  to anon, authenticated
  using (zichtbaar and gepubliceerd_op <= now());

-- Admins zien alles (ook verborgen en ingeplande berichten)
create policy "Admins lezen alles"
  on public.berichten for select
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

create policy "Admins plaatsen berichten"
  on public.berichten for insert
  to authenticated
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

create policy "Admins wijzigen berichten"
  on public.berichten for update
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

create policy "Admins verwijderen berichten"
  on public.berichten for delete
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

revoke all on public.berichten from anon, authenticated;
grant select on public.berichten to anon, authenticated;
grant insert (titel, tekst, categorie, vastgepind, zichtbaar, gepubliceerd_op),
      update (titel, tekst, categorie, vastgepind, zichtbaar, gepubliceerd_op),
      delete
  on public.berichten to authenticated;

-- ===== Drie startberichten (kun je in de adminpagina aanpassen of verwijderen) =====
insert into public.berichten (titel, tekst, categorie, vastgepind) values
  ('Welkom bij MoveForPleasure! 👋',
   'Fijn dat je er bent. Hier verschijnen regelmatig tips, weetjes en een flinke dosis motivatie. Begin met een haalbaar weekdoel: 2 of 3 dagen is perfect. Consequent zijn wint het altijd van perfect zijn.',
   'nieuws', true),
  ('Een slechte training bestaat niet',
   'Ook een korte of "slappe" training is een overwinning: je hebt de gewoonte in stand gehouden. Op dagen dat je geen zin hebt, spreek je af dat je maar 10 minuten doet. Vaak ga je daarna gewoon door.',
   'motivatie', false),
  ('Weetje: spieren groeien in je rust',
   'Tijdens het trainen maak je kleine beschadigingen in je spieren. Het sterker worden gebeurt pas daarna, als je herstelt en goed slaapt. Rustdagen horen dus gewoon bij je schema.',
   'weetje', false);
