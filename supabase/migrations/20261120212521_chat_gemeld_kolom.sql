-- Houdt bij of er voor dit bericht al een mailmelding verwerkt is
alter table public.chatberichten add column gemeld boolean not null default false;
comment on column public.chatberichten.gemeld is 'True zodra de mailmelding (Edge Function chat-melding) dit bericht verwerkt heeft.';
