create extension if not exists pg_net with schema extensions;

-- Bij elk nieuw chatbericht: de Edge Function "chat-melding" seinen (asynchroon).
-- Er gaat alleen het id mee; de functie zoekt de rest zelf veilig op.
create or replace function public.chat_mail_seinen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://wrwwwgquqaqnmphrhvyr.supabase.co/functions/v1/chat-melding',
    body := jsonb_build_object('id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
end;
$$;
revoke all on function public.chat_mail_seinen() from public, anon, authenticated;

create trigger chat_mail_seinen after insert on public.chatberichten
  for each row execute function public.chat_mail_seinen();
