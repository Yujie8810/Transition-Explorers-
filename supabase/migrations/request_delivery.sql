-- Run ONCE after people_directory.sql. This adds delivery for NEW real-user
-- requests. Old private requests stay private; demo requests remain personal.
begin;
set local search_path = public, extensions;
alter table public.circle_contacts add constraint circle_contacts_not_self
  check (guide_id <> user_id::text) not valid;

alter table public.guidance_requests
  add column recipient_id uuid generated always as (
    case when guide_id ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then guide_id::uuid end
  ) stored,
  add column delivered_at timestamptz,
  add column status text not null default 'pending'
    check (status in ('pending', 'answered', 'accepted', 'declined')),
  add column response text check (response is null or char_length(trim(response)) <= 5000),
  add column responded_at timestamptz,
  add column sender_hidden boolean not null default false;
create index guidance_requests_recipient_created_idx on public.guidance_requests(recipient_id, created_at)
  where delivered_at is not null;

create function public.prepare_guidance_delivery()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception 'This request does not belong to your account' using errcode = '42501';
  end if;
  if new.guide_id = new.user_id::text then
    raise exception 'You cannot request guidance from yourself.' using errcode = '23514';
  end if;
  if new.status <> 'pending' or new.response is not null or new.responded_at is not null or new.sender_hidden then
    raise exception 'New requests must be pending without a response' using errcode = '23514';
  end if;
  -- Never trust a client-supplied delivery time. Old rows are not retroactively sent.
  new.delivered_at := case when exists (select 1 from public."Profiles" where id::text = new.guide_id)
    then statement_timestamp() else null end;
  return new;
end $$;
revoke all on function public.prepare_guidance_delivery() from public, anon, authenticated;
create trigger guidance_requests_prepare_delivery before insert on public.guidance_requests
  for each row execute function public.prepare_guidance_delivery();

drop policy guidance_requests_read on public.guidance_requests;
create policy guidance_requests_read on public.guidance_requests for select to authenticated
  using (user_id = (select auth.uid()) or (recipient_id = (select auth.uid()) and delivered_at is not null));
-- Delivered requests are shared records. Dismissing hides the sender's copy;
-- direct DELETE remains available only for old private and demo requests.
drop policy guidance_requests_delete on public.guidance_requests;
create policy guidance_requests_delete on public.guidance_requests for delete to authenticated
  using (user_id = (select auth.uid()) and delivered_at is null);

-- No client UPDATE permission is granted. Only these narrow authenticated RPCs
-- may change response fields; request authors and third parties cannot forge replies.
create function public.respond_to_guidance_request(
  p_account_id uuid, p_request_id uuid, p_decision text, p_response text default ''
) returns setof public.guidance_requests
language plpgsql security definer set search_path = '' as $$
declare saved public.guidance_requests%rowtype; clean_response text := trim(coalesce(p_response, ''));
begin
  if auth.uid() is null or p_account_id is distinct from auth.uid() then
    raise exception 'Your account changed. Please sign in again.' using errcode = '42501';
  end if;
  select * into saved from public.guidance_requests where id = p_request_id
    and recipient_id = auth.uid() and user_id <> auth.uid() and delivered_at is not null for update;
  if not found then raise exception 'This request is unavailable.' using errcode = '42501'; end if;
  if saved.kind <> 'check-in' or p_decision is null or p_decision not in ('accepted', 'declined')
    or char_length(clean_response) > 5000 then
    raise exception 'Choose a valid response and keep it within 5000 characters.' using errcode = '22023';
  end if;
  -- Identical retries after a lost response are safe. Competing decisions cannot
  -- silently overwrite each other on another device.
  if saved.status <> 'pending' then
    if saved.status = p_decision and coalesce(saved.response, '') = clean_response then return next saved; return; end if;
    raise exception 'This request has already been answered. Refresh your inbox.' using errcode = '40001';
  end if;
  update public.guidance_requests set status = p_decision, response = nullif(clean_response, ''),
    responded_at = statement_timestamp(), sender_hidden = false where id = saved.id returning * into saved;
  return next saved;
end $$;
revoke all on function public.respond_to_guidance_request(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.respond_to_guidance_request(uuid, uuid, text, text) to authenticated;

create function public.hide_guidance_request(p_account_id uuid, p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_account_id is distinct from auth.uid() then
    raise exception 'Your account changed. Please sign in again.' using errcode = '42501';
  end if;
  update public.guidance_requests set sender_hidden = true where id = p_request_id and user_id = auth.uid();
  if not found then raise exception 'This request is unavailable.' using errcode = '42501'; end if;
end $$;
revoke all on function public.hide_guidance_request(uuid, uuid) from public, anon, authenticated;
grant execute on function public.hide_guidance_request(uuid, uuid) to authenticated;

-- Chat messages are immutable and private to the two request participants.
create table public.guidance_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.guidance_requests(id) on delete cascade,
  sender_id uuid not null references public."Profiles"(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  client_token text not null check (char_length(client_token) between 1 and 200),
  unique(request_id, sender_id, client_token)
);
create index guidance_messages_request_created_idx on public.guidance_messages(request_id, created_at);
alter table public.guidance_messages enable row level security;
revoke all on public.guidance_messages from public, anon, authenticated;
grant select on public.guidance_messages to authenticated;
create policy guidance_messages_participant_read on public.guidance_messages for select to authenticated
  using (exists (select 1 from public.guidance_requests r where r.id = request_id and r.delivered_at is not null
    and (r.user_id = (select auth.uid()) or r.recipient_id = (select auth.uid()))));
create function public.send_guidance_message(p_account_id uuid, p_request_id uuid, p_body text, p_client_token text)
returns setof public.guidance_messages language plpgsql security definer set search_path = '' as $$
declare request public.guidance_requests%rowtype; message public.guidance_messages%rowtype;
  clean_body text := trim(coalesce(p_body, ''));
begin
  if auth.uid() is null or p_account_id is distinct from auth.uid() then
    raise exception 'Your account changed. Please sign in again.' using errcode = '42501';
  end if;
  select * into request from public.guidance_requests where id = p_request_id and delivered_at is not null
    and (user_id = auth.uid() or recipient_id = auth.uid()) and user_id <> recipient_id for update;
  if not found then raise exception 'This conversation is unavailable.' using errcode = '42501'; end if;
  if char_length(clean_body) not between 1 and 5000 or p_client_token is null
    or char_length(p_client_token) not between 1 and 200 then
    raise exception 'Write a message using 1–5000 characters.' using errcode = '22023';
  end if;
  insert into public.guidance_messages(request_id, sender_id, body, client_token)
    values(p_request_id, auth.uid(), clean_body, p_client_token)
    on conflict(request_id, sender_id, client_token) do nothing;
  select * into strict message from public.guidance_messages where request_id = p_request_id
    and sender_id = auth.uid() and client_token = p_client_token;
  if message.body <> clean_body then raise exception 'Retry token already belongs to another message.' using errcode = '22023'; end if;
  if request.kind = 'advice' and request.recipient_id = auth.uid() then
    update public.guidance_requests set status = 'answered', response = message.body,
      responded_at = message.created_at, sender_hidden = false where id = request.id
      and (responded_at is null or responded_at <= message.created_at);
  end if;
  return next message;
end $$;
revoke all on function public.send_guidance_message(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.send_guidance_message(uuid, uuid, text, text) to authenticated;

-- NEW timed plans for real profiles become invitations. Existing plans keep
-- their private/personal meaning until the sender explicitly edits them.
alter table public.check_ins
  add column recipient_id uuid generated always as (
    case when guide_id ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then guide_id::uuid end
  ) stored,
  add column delivered_at timestamptz,
  add column status text not null default 'personal'
    check (status in ('personal', 'pending', 'accepted', 'declined', 'cancelled')),
  add column responded_at timestamptz,
  add column revision integer not null default 1;
create index check_ins_recipient_start_idx on public.check_ins(recipient_id, starts_at) where delivered_at is not null;
-- A booking for the sender reserves their time while pending. Acceptance also
-- reserves the recipient's time. One exclusion constraint prevents conflicting
-- incoming/outgoing meetings, even when two devices accept concurrently.
create table public.check_in_bookings (
  check_in_id uuid not null references public.check_ins(id) on delete cascade,
  participant_id uuid not null references public."Profiles"(id) on delete cascade,
  starts_at timestamptz not null, ends_at timestamptz not null,
  primary key(check_in_id, participant_id),
  constraint check_in_bookings_no_overlap exclude using gist (
    participant_id with =, tstzrange(starts_at, ends_at, '[)') with &&
  )
);
alter table public.check_in_bookings enable row level security;
revoke all on public.check_in_bookings from public, anon, authenticated;
insert into public.check_in_bookings(check_in_id, participant_id, starts_at, ends_at)
  select id, user_id, starts_at, ends_at from public.check_ins;
-- Retain the sender-level constraint with a status predicate too.
alter table public.check_ins drop constraint check_ins_no_overlap;
alter table public.check_ins add constraint check_ins_no_overlap exclude using gist (
  user_id with =, tstzrange(starts_at, ends_at, '[)') with &&
) where (status in ('personal', 'pending', 'accepted'));

drop policy check_ins_read on public.check_ins;
create policy check_ins_read on public.check_ins for select to authenticated
  using (user_id = (select auth.uid()) or (recipient_id = (select auth.uid()) and delivered_at is not null));
drop policy check_ins_delete on public.check_ins;
create policy check_ins_delete on public.check_ins for delete to authenticated
  using (user_id = (select auth.uid()) and delivered_at is null);
-- Schedule/response/cancellation mutations use explicitly guarded RPCs below.
revoke insert, update on public.check_ins from authenticated;

create or replace function public.validate_check_in()
returns trigger language plpgsql security definer set search_path = '' as $$
declare changed boolean;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id or new.id is distinct from old.id
      or new.guide_id is distinct from old.guide_id or new.client_token is distinct from old.client_token
      or new.created_at is distinct from old.created_at then
      raise exception 'Check-in identity cannot be changed.' using errcode = '42501';
    end if;
    changed := new.topic is distinct from old.topic or new.starts_at is distinct from old.starts_at
      or new.duration_minutes is distinct from old.duration_minutes;
    if auth.uid() <> old.user_id then
      if auth.uid() is distinct from old.recipient_id or old.delivered_at is null or changed
        or new.ends_at is distinct from old.ends_at or new.delivered_at is distinct from old.delivered_at
        or new.revision <> old.revision or new.status not in ('accepted', 'declined') or old.status <> 'pending' then
        raise exception 'Only the recipient may respond to a pending invitation.' using errcode = '42501';
      end if;
      if old.starts_at <= statement_timestamp() then
        raise exception 'This invitation has expired. Ask for a new time.' using errcode = '23514';
      end if;
      return new;
    end if;
    if new.status = 'cancelled' and not changed then return new; end if;
    if old.status = 'cancelled' then raise exception 'This check-in was cancelled.' using errcode = '23514'; end if;
    new.delivered_at := old.delivered_at;
    new.revision := old.revision;
    new.status := old.status;
    new.responded_at := old.responded_at;
    if changed then
      new.revision := old.revision + 1;
      new.delivered_at := case when exists(select 1 from public."Profiles" where id::text = new.guide_id)
        then statement_timestamp() else null end;
      new.status := case when new.delivered_at is null then 'personal' else 'pending' end;
      new.responded_at := null;
    end if;
  else
    if new.user_id is distinct from auth.uid() then raise exception 'This plan does not belong to your account.' using errcode = '42501'; end if;
    new.delivered_at := case when exists(select 1 from public."Profiles" where id::text = new.guide_id)
      then statement_timestamp() else null end;
    new.status := case when new.delivered_at is null then 'personal' else 'pending' end;
    new.responded_at := null;
    new.revision := 1;
  end if;
  if new.user_id::text = new.guide_id then raise exception 'You cannot schedule a check-in with yourself.' using errcode = '23514'; end if;
  if not isfinite(new.starts_at) or new.starts_at <= statement_timestamp() then
    raise exception 'Choose a future date and time.' using errcode = '23514';
  end if;
  update public.circle_contacts set created_at = created_at where user_id = new.user_id and guide_id = new.guide_id;
  if not found then raise exception 'Add this person to your circle first.' using errcode = '23503'; end if;
  new.topic := trim(new.topic);
  new.ends_at := new.starts_at + make_interval(mins => new.duration_minutes);
  return new;
end $$;

create function public.sync_check_in_bookings()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.check_in_bookings where check_in_id = new.id;
  if new.status in ('personal', 'pending', 'accepted') then
    insert into public.check_in_bookings values(new.id, new.user_id, new.starts_at, new.ends_at);
    if new.status = 'accepted' and new.recipient_id is not null then
      insert into public.check_in_bookings values(new.id, new.recipient_id, new.starts_at, new.ends_at);
    end if;
  end if;
  return new;
end $$;
revoke all on function public.sync_check_in_bookings() from public, anon, authenticated;
create trigger check_ins_sync_bookings after insert or update on public.check_ins
  for each row execute function public.sync_check_in_bookings();

create or replace function public.guard_contact_check_ins()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public."Profiles" where id = old.user_id) then return old; end if;
  if exists(select 1 from public.check_ins where user_id = old.user_id and guide_id = old.guide_id
    and status in ('personal', 'pending', 'accepted') and ends_at > statement_timestamp()) then
    raise exception 'Cancel upcoming check-ins before removing this contact.' using errcode = '23514';
  end if;
  return old;
end $$;

-- Identity is checked before privileged access. Row locks serialize edits,
-- cancellation and decisions for the same invitation.
create or replace function public.save_check_in(
  p_account_id uuid, p_guide_id text, p_topic text, p_duration_minutes integer,
  p_starts_at timestamptz, p_client_token text, p_check_in_id uuid default null
) returns setof public.check_ins language plpgsql security definer set search_path = '' as $$
declare saved public.check_ins%rowtype;
begin
  if auth.uid() is null or p_account_id is distinct from auth.uid() then
    raise exception 'Your account changed. Please sign in again.' using errcode = '42501';
  end if;
  if p_check_in_id is not null then
    select * into saved from public.check_ins where id = p_check_in_id and user_id = auth.uid() for update;
    if not found then raise exception 'This check-in is unavailable.' using errcode = '42501'; end if;
    update public.check_ins set guide_id = p_guide_id, topic = trim(p_topic), duration_minutes = p_duration_minutes,
      starts_at = p_starts_at where id = saved.id returning * into saved;
  else
    insert into public.check_ins(user_id, guide_id, topic, duration_minutes, starts_at, client_token)
      values(auth.uid(), p_guide_id, trim(p_topic), p_duration_minutes, p_starts_at, p_client_token)
      on conflict(user_id, client_token) do nothing;
    select * into strict saved from public.check_ins where user_id = auth.uid() and client_token = p_client_token;
    if saved.guide_id is distinct from p_guide_id or saved.topic is distinct from trim(p_topic)
      or saved.duration_minutes is distinct from p_duration_minutes or saved.starts_at is distinct from p_starts_at then
      raise exception 'Retry token already belongs to another check-in.' using errcode = '22023';
    end if;
  end if;
  return next saved;
end $$;

create function public.respond_to_check_in(p_account_id uuid, p_check_in_id uuid, p_decision text, p_expected_revision integer)
returns setof public.check_ins language plpgsql security definer set search_path = '' as $$
declare saved public.check_ins%rowtype;
begin
  if auth.uid() is null or p_account_id is distinct from auth.uid() then
    raise exception 'Your account changed. Please sign in again.' using errcode = '42501';
  end if;
  select * into saved from public.check_ins where id = p_check_in_id and recipient_id = auth.uid()
    and user_id <> auth.uid() and delivered_at is not null for update;
  if not found then raise exception 'This invitation is unavailable.' using errcode = '42501'; end if;
  if p_expected_revision is distinct from saved.revision then
    raise exception 'The sender changed this invitation. Refresh and review the new time.' using errcode = '40001';
  end if;
  if p_decision is null or p_decision not in ('accepted', 'declined') then
    raise exception 'Choose Accept or Decline.' using errcode = '22023';
  end if;
  if saved.status = p_decision then return next saved; return; end if;
  if saved.status <> 'pending' then raise exception 'This invitation is no longer pending. Refresh your circle.' using errcode = '40001'; end if;
  update public.check_ins set status = p_decision, responded_at = statement_timestamp() where id = saved.id returning * into saved;
  return next saved;
end $$;
revoke all on function public.respond_to_check_in(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.respond_to_check_in(uuid, uuid, text, integer) to authenticated;

create function public.cancel_check_in(p_account_id uuid, p_check_in_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare saved public.check_ins%rowtype;
begin
  if auth.uid() is null or p_account_id is distinct from auth.uid() then
    raise exception 'Your account changed. Please sign in again.' using errcode = '42501';
  end if;
  select * into saved from public.check_ins where id = p_check_in_id and user_id = auth.uid() for update;
  if not found then return; end if; -- Idempotent retry of a deleted demo plan.
  if saved.delivered_at is null then delete from public.check_ins where id = saved.id;
  else update public.check_ins set status = 'cancelled' where id = saved.id; end if;
end $$;
revoke all on function public.cancel_check_in(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_check_in(uuid, uuid) to authenticated;
commit;
