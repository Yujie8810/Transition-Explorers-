-- Run ONCE after request_delivery.sql. Proposals leave the original meeting
-- unchanged until its original sender accepts the new time.
begin;
create table public.check_in_time_proposals (
  id uuid primary key default gen_random_uuid(),
  check_in_id uuid not null references public.check_ins(id) on delete cascade,
  proposer_id uuid not null references public."Profiles"(id) on delete cascade,
  base_revision integer not null,
  starts_at timestamptz not null,
  duration_minutes integer not null check(duration_minutes in (15, 30)),
  status text not null default 'pending' check(status in ('pending', 'accepted', 'rejected', 'superseded')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  client_token text not null check(char_length(client_token) between 1 and 200),
  unique(proposer_id, client_token)
);
create unique index check_in_one_pending_time_proposal on public.check_in_time_proposals(check_in_id) where status = 'pending';
alter table public.check_in_time_proposals enable row level security;
revoke all on public.check_in_time_proposals from public, anon, authenticated;
grant select on public.check_in_time_proposals to authenticated;
create policy check_in_time_proposals_participant_read on public.check_in_time_proposals for select to authenticated
  using (exists(select 1 from public.check_ins c where c.id = check_in_id and c.delivered_at is not null
    and (c.user_id = (select auth.uid()) or c.recipient_id = (select auth.uid()))));

create function public.propose_check_in_time(
  p_account_id uuid, p_check_in_id uuid, p_expected_revision integer,
  p_starts_at timestamptz, p_duration_minutes integer, p_client_token text
) returns setof public.check_in_time_proposals language plpgsql security definer set search_path = '' as $$
declare meeting public.check_ins%rowtype; proposal public.check_in_time_proposals%rowtype;
begin
  if auth.uid() is null or p_account_id is distinct from auth.uid() then
    raise exception 'Your account changed. Please sign in again.' using errcode = '42501'; end if;
  select * into meeting from public.check_ins where id = p_check_in_id and recipient_id = auth.uid()
    and user_id <> auth.uid() and delivered_at is not null for update;
  if not found then raise exception 'Only the invited person can propose a new time.' using errcode = '42501'; end if;
  select * into proposal from public.check_in_time_proposals where proposer_id = auth.uid() and client_token = p_client_token;
  if found then
    if proposal.check_in_id is distinct from p_check_in_id or proposal.base_revision is distinct from p_expected_revision
      or proposal.starts_at is distinct from p_starts_at or proposal.duration_minutes is distinct from p_duration_minutes then
      raise exception 'Retry token already belongs to another proposal.' using errcode = '22023'; end if;
    return next proposal; return;
  end if;
  if meeting.revision is distinct from p_expected_revision or meeting.status = 'cancelled'
    or meeting.ends_at <= statement_timestamp() then
    raise exception 'This invitation changed or expired. Refresh your circle.' using errcode = '40001'; end if;
  if p_starts_at is null or not isfinite(p_starts_at) or p_starts_at <= statement_timestamp()
    or p_duration_minutes is null or p_duration_minutes not in (15, 30) then
    raise exception 'Choose a valid future time and duration.' using errcode = '22023'; end if;
  if p_starts_at = meeting.starts_at and p_duration_minutes = meeting.duration_minutes then
    raise exception 'Choose a different time or duration.' using errcode = '22023'; end if;
  if exists(select 1 from public.check_in_time_proposals where check_in_id = meeting.id and status = 'pending') then
    raise exception 'A proposed time is already awaiting the sender response.' using errcode = '40001'; end if;
  insert into public.check_in_time_proposals(check_in_id, proposer_id, base_revision, starts_at, duration_minutes, client_token)
    values(meeting.id, auth.uid(), meeting.revision, p_starts_at, p_duration_minutes, p_client_token) returning * into proposal;
  return next proposal;
end $$;
revoke all on function public.propose_check_in_time(uuid, uuid, integer, timestamptz, integer, text) from public, anon, authenticated;
grant execute on function public.propose_check_in_time(uuid, uuid, integer, timestamptz, integer, text) to authenticated;

-- The normal validation trigger remains authoritative. This narrow additional
-- branch permits the original sender to accept exactly an approved proposal.
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
    if auth.uid() = old.user_id and new.status = 'accepted' and exists (
      select 1 from public.check_in_time_proposals p where p.check_in_id = old.id and p.status = 'accepted'
        and p.base_revision = old.revision and p.starts_at = new.starts_at and p.duration_minutes = new.duration_minutes
    ) then
      if old.status = 'cancelled' or not isfinite(new.starts_at) or new.starts_at <= statement_timestamp() then
        raise exception 'This proposal is no longer available.' using errcode = '23514'; end if;
      if new.topic is distinct from old.topic or new.delivered_at is distinct from old.delivered_at then
        raise exception 'Accept only the proposed time and duration.' using errcode = '42501'; end if;
      update public.circle_contacts set created_at = created_at where user_id = new.user_id and guide_id = new.guide_id;
      if not found then raise exception 'Add this person to your circle first.' using errcode = '23503'; end if;
      new.ends_at := new.starts_at + make_interval(mins => new.duration_minutes);
      new.revision := old.revision + 1;
      new.responded_at := statement_timestamp();
      return new;
    end if;
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

create or replace function public.respond_to_check_in(p_account_id uuid, p_check_in_id uuid, p_decision text, p_expected_revision integer)
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
  if p_decision = 'accepted' and exists(select 1 from public.check_in_time_proposals
    where check_in_id = saved.id and status = 'pending') then
    raise exception 'Your new time is awaiting the sender response.' using errcode = '40001'; end if;
  if saved.status = p_decision then return next saved; return; end if;
  if saved.status <> 'pending' then raise exception 'This invitation is no longer pending. Refresh your circle.' using errcode = '40001'; end if;
  update public.check_ins set status = p_decision, responded_at = statement_timestamp() where id = saved.id returning * into saved;
  return next saved;
end $$;
revoke all on function public.respond_to_check_in(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.respond_to_check_in(uuid, uuid, text, integer) to authenticated;

create function public.respond_to_check_in_time_proposal(p_account_id uuid, p_proposal_id uuid, p_decision text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare proposal public.check_in_time_proposals%rowtype; meeting public.check_ins%rowtype;
begin
  if auth.uid() is null or p_account_id is distinct from auth.uid() then
    raise exception 'Your account changed. Please sign in again.' using errcode = '42501'; end if;
  if p_decision is null or p_decision not in ('accepted', 'rejected') then
    raise exception 'Choose Accept or Reject for the new time.' using errcode = '22023'; end if;
  select * into proposal from public.check_in_time_proposals where id = p_proposal_id;
  if not found then raise exception 'This proposal is unavailable.' using errcode = '42501'; end if;
  -- Lock in the same order as proposing and editing: meeting first, then proposal.
  select * into meeting from public.check_ins where id = proposal.check_in_id and user_id = auth.uid()
    and delivered_at is not null for update;
  if not found then raise exception 'Only the original sender can decide on this proposal.' using errcode = '42501'; end if;
  select * into strict proposal from public.check_in_time_proposals where id = p_proposal_id for update;
  if proposal.status = p_decision then return jsonb_build_object('proposal', to_jsonb(proposal), 'check_in', to_jsonb(meeting)); end if;
  if proposal.status <> 'pending' or proposal.base_revision <> meeting.revision or meeting.status = 'cancelled'
    or meeting.ends_at <= statement_timestamp() then
    raise exception 'This proposal changed or expired. Refresh your circle.' using errcode = '40001'; end if;
  if p_decision = 'accepted' and proposal.starts_at <= statement_timestamp() then
    raise exception 'The proposed time has passed. Ask for a new time.' using errcode = '22023'; end if;
  update public.check_in_time_proposals set status = p_decision, responded_at = statement_timestamp()
    where id = proposal.id returning * into proposal;
  if p_decision = 'accepted' then
    -- Both calendar bookings update in the same transaction. A conflict rolls
    -- back the decision as well, leaving the proposal pending for both people.
    update public.check_ins set starts_at = proposal.starts_at, duration_minutes = proposal.duration_minutes,
      status = 'accepted' where id = meeting.id returning * into meeting;
  end if;
  return jsonb_build_object('proposal', to_jsonb(proposal), 'check_in', to_jsonb(meeting));
end $$;
revoke all on function public.respond_to_check_in_time_proposal(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.respond_to_check_in_time_proposal(uuid, uuid, text) to authenticated;

create function public.invalidate_check_in_time_proposals()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.revision <> old.revision or new.status in ('cancelled', 'declined') then
    update public.check_in_time_proposals set status = 'superseded', responded_at = statement_timestamp()
      where check_in_id = new.id and status = 'pending';
  end if;
  return new;
end $$;
revoke all on function public.invalidate_check_in_time_proposals() from public, anon, authenticated;
create trigger check_ins_invalidate_time_proposals after update on public.check_ins
  for each row execute function public.invalidate_check_in_time_proposals();
commit;
