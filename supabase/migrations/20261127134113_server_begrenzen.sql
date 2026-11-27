-- 1. Chat: tijdstip en status bepaalt de SERVER, niet de app.
--    Zo kan niemand de spamlimiet (30/uur) of de mailcontrole omzeilen
--    door zelf een oud tijdstip mee te sturen.
create or replace function public.chat_vaste_waarden()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.aangemaakt := now();
  new.gemeld := false;
  new.gelezen := false;
  return new;
end;
$$;
-- naam begint met "a" zodat hij als eerste loopt (triggers lopen alfabetisch)
create trigger a_chat_vaste_waarden before insert on public.chatberichten
  for each row execute function public.chat_vaste_waarden();

-- 2. Groottelimiet per opgeslagen onderdeel (1 MB): genoeg voor jaren
--    trainen, maar niemand kan de gratis database volpompen.
alter table public.gebruikersdata
  add constraint gebruikersdata_waarde_grootte check (pg_column_size(waarde) <= 1048576);

-- 3. Opruimen van onnodige rechten (Advisor 0028/0029):
--    triggerfuncties hoeft niemand rechtstreeks aan te roepen.
revoke execute on function public.chat_vaste_waarden() from public, anon, authenticated;
revoke execute on function public.chat_limiet() from public, anon, authenticated;
revoke execute on function public.chat_mail_seinen() from public, anon, authenticated;
revoke all on table public.weekmail_verstuurd from anon, authenticated;
