-- Nieuwe sync-sleutel "verwijderd": onthoudt welke items gewist zijn,
-- zodat ze bij het samenvoegen van toestellen niet terugkomen.
alter table public.gebruikersdata drop constraint gebruikersdata_sleutel_check;
alter table public.gebruikersdata add constraint gebruikersdata_sleutel_check
  check (sleutel in ('workouts','cardio','schema','weekdoel','profiel','gewichten','badges-gezien','berichten-gelezen','verwijderd'));
