-- Run ONCE in SQL Editor AFTER profiles.sql and circle_contacts.sql are deployed.
begin;

create table public.guidance_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public."Profiles"(id) on delete cascade,
  -- These are still the fictional People guide IDs, not real recipients.
  guide_id text not null check (guide_id in (
    'taylor', 'anika', 'jordan', 'priya', 'sam', 'marcus', 'elena'
  )),
  kind text not null check (kind in ('advice', 'check-in')),
  message text not null check (char_length(trim(message)) between 1 and 2000),
  created_at timestamptz not null default now(),
  -- Reuse a token when retrying an uncertain network result, preventing duplicates.
  client_token text not null check (char_length(client_token) between 1 and 200),
  unique (user_id, client_token)
);
create index guidance_requests_owner_created_idx
  on public.guidance_requests(user_id, created_at);

alter table public.guidance_requests enable row level security;
revoke all on public.guidance_requests from public, anon, authenticated;
grant select, insert, delete on public.guidance_requests to authenticated;
create policy guidance_requests_read on public.guidance_requests
  for select to authenticated using (user_id = (select auth.uid()));
create policy guidance_requests_insert on public.guidance_requests
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy guidance_requests_delete on public.guidance_requests
  for delete to authenticated using (user_id = (select auth.uid()));

-- One RPC call is one database transaction: request AND contact commit together.
-- SECURITY INVOKER keeps the caller's table grants and RLS in force.
create function public.save_guidance_request(
  p_account_id uuid,
  p_guide_id text,
  p_kind text,
  p_message text,
  p_client_token text
)
returns setof public.guidance_requests
language plpgsql
security invoker
set search_path = ''
as $$
declare saved public.guidance_requests%rowtype;
begin
  -- Explicit identity protects a delayed action after an account/session switch.
  if auth.uid() is null or p_account_id is distinct from auth.uid() then
    raise exception 'This request does not belong to the signed-in account' using errcode = '42501';
  end if;

  insert into public.guidance_requests(user_id, guide_id, kind, message, client_token)
    values (p_account_id, p_guide_id, p_kind, trim(p_message), p_client_token)
    on conflict (user_id, client_token) do nothing;

  select * into strict saved from public.guidance_requests
    where user_id = p_account_id and client_token = p_client_token;
  -- A retry token must not silently accept different content.
  if saved.guide_id is distinct from p_guide_id or saved.kind is distinct from p_kind
      or saved.message is distinct from trim(p_message) then
    raise exception 'Retry token already belongs to a different request' using errcode = '22023';
  end if;

  insert into public.circle_contacts(user_id, guide_id)
    values (p_account_id, p_guide_id) on conflict (user_id, guide_id) do nothing;
  return next saved;
end $$;

-- PostgreSQL functions otherwise default to public execution access.
revoke all on function public.save_guidance_request(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.save_guidance_request(uuid, text, text, text, text)
  to authenticated;
commit;
