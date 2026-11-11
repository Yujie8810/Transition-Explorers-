-- Run ONCE after Profiles, circle_contacts, and guidance_requests are deployed.
begin;
create extension if not exists btree_gist with schema extensions;
set local search_path = public, extensions;

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public."Profiles"(id) on delete cascade,
  guide_id text not null check (guide_id in (
    'taylor', 'anika', 'jordan', 'priya', 'sam', 'marcus', 'elena'
  )),
  topic text not null check (char_length(trim(topic)) between 1 and 200),
  duration_minutes integer not null check (duration_minutes in (15, 30)),
  starts_at timestamptz not null,
  -- Computed by the validation trigger, never trusted from client input.
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  client_token text not null check (char_length(client_token) between 1 and 200),
  unique (user_id, client_token),
  check (ends_at > starts_at),
  -- A real database constraint prevents races between simultaneous device saves.
  -- [start,end) allows the next appointment to begin exactly when one ends.
  constraint check_ins_no_overlap exclude using gist (
    user_id with =, tstzrange(starts_at, ends_at, '[)') with &&
  )
);
create index check_ins_owner_start_idx on public.check_ins(user_id, starts_at);
alter table public.check_ins enable row level security;
revoke all on public.check_ins from public, anon, authenticated;
grant select, insert, update, delete on public.check_ins to authenticated;
create policy check_ins_read on public.check_ins for select to authenticated
  using (user_id = (select auth.uid()));
create policy check_ins_insert on public.check_ins for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy check_ins_update on public.check_ins for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy check_ins_delete on public.check_ins for delete to authenticated
  using (user_id = (select auth.uid()));

create function public.validate_check_in()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- This narrowly scoped definer trigger can touch contacts without granting
  -- contact UPDATE permission to app users. Always verify identity explicitly.
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception 'Check-in does not belong to this account' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id or new.id is distinct from old.id
        or new.client_token is distinct from old.client_token
        or new.created_at is distinct from old.created_at then
      raise exception 'Check-in identity cannot be changed' using errcode = '42501';
    end if;
  end if;
  if not isfinite(new.starts_at) or new.starts_at <= statement_timestamp() then
    raise exception 'Choose a future date and time.' using errcode = '23514';
  end if;
  -- Touch the contact without changing its timestamp. This holds its row lock
  -- until commit and creates a new row version: a stale repeatable-read DELETE
  -- gets a serialization failure rather than overlooking a newly saved plan.
  update public.circle_contacts set created_at = created_at
    where user_id = new.user_id and guide_id = new.guide_id;
  if not found then
    raise exception 'Add this graduate to your circle first.' using errcode = '23503';
  end if;
  new.topic := trim(new.topic);
  new.ends_at := new.starts_at + make_interval(mins => new.duration_minutes);
  return new;
end $$;
revoke all on function public.validate_check_in() from public, anon, authenticated;
create trigger check_ins_validate before insert or update on public.check_ins
  for each row execute function public.validate_check_in();

create function public.guard_contact_check_ins()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Permit the existing Profiles -> contacts/check-ins account-deletion cascade.
  if not exists (select 1 from public."Profiles" where id = old.user_id) then return old; end if;
  -- DELETE already holds the contact row lock. The volatile trigger's query sees
  -- schedules committed while DELETE was waiting for a scheduling transaction.
  if exists (select 1 from public.check_ins where user_id = old.user_id
      and guide_id = old.guide_id and ends_at > statement_timestamp()) then
    raise exception 'Cancel upcoming check-ins before removing this contact.' using errcode = '23514';
  end if;
  -- Past check-ins remain as history; there is intentionally no contact FK.
  return old;
end $$;
revoke all on function public.guard_contact_check_ins() from public, anon, authenticated;
create trigger circle_contacts_guard_check_ins before delete on public.circle_contacts
  for each row execute function public.guard_contact_check_ins();

create function public.save_check_in(
  p_account_id uuid, p_guide_id text, p_topic text, p_duration_minutes integer,
  p_starts_at timestamptz, p_client_token text, p_check_in_id uuid default null
)
returns setof public.check_ins language plpgsql security invoker set search_path = '' as $$
declare saved public.check_ins%rowtype;
begin
  if auth.uid() is null or p_account_id is distinct from auth.uid() then
    raise exception 'Check-in does not belong to this account' using errcode = '42501';
  end if;
  if p_check_in_id is not null then
    -- The explicit owner filter and RLS both prevent editing another account's ID.
    update public.check_ins set guide_id = p_guide_id, topic = p_topic,
      duration_minutes = p_duration_minutes, starts_at = p_starts_at
      where id = p_check_in_id and user_id = p_account_id returning * into saved;
    if not found then raise exception 'This check-in no longer exists.' using errcode = 'P0002'; end if;
  else
    insert into public.check_ins(user_id, guide_id, topic, duration_minutes, starts_at, client_token)
      values (p_account_id, p_guide_id, p_topic, p_duration_minutes, p_starts_at, p_client_token)
      on conflict (user_id, client_token) do nothing;
    select * into strict saved from public.check_ins
      where user_id = p_account_id and client_token = p_client_token;
    if saved.guide_id is distinct from p_guide_id or saved.topic is distinct from trim(p_topic)
        or saved.duration_minutes is distinct from p_duration_minutes
        or saved.starts_at is distinct from p_starts_at then
      raise exception 'Retry token already belongs to a different check-in' using errcode = '22023';
    end if;
  end if;
  return next saved;
end $$;
revoke all on function public.save_check_in(uuid, text, text, integer, timestamptz, text, uuid)
  from public, anon, authenticated;
grant execute on function public.save_check_in(uuid, text, text, integer, timestamptz, text, uuid)
  to authenticated;
commit;
