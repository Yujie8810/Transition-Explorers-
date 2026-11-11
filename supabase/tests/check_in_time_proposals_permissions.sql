-- Run the WHOLE file after check_in_time_proposals.sql. Replace A/B with two
-- existing account/Profile UUIDs. All fixtures/calendar changes roll back.
begin;
select set_config('test.account_a', '0c3db29f-c99c-4620-bf3e-a26a970a29da', true);
select set_config('test.account_b', 'c2165341-932d-4d2f-804f-26fd76b71aaf', true);
select set_config('test.account_c', gen_random_uuid()::text, true);
do $$ begin
  if current_setting('test.account_a')::uuid = current_setting('test.account_b')::uuid
    or not exists(select 1 from public."Profiles" where id = current_setting('test.account_a')::uuid)
    or not exists(select 1 from public."Profiles" where id = current_setting('test.account_b')::uuid) then
    raise exception 'Use two different existing Profile accounts'; end if;
end $$;
delete from public.check_ins where user_id in (current_setting('test.account_a')::uuid, current_setting('test.account_b')::uuid)
  or recipient_id in (current_setting('test.account_a')::uuid, current_setting('test.account_b')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.account_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.account_a'), 'role', 'authenticated')::text, true);
do $$ declare meeting_id uuid; begin
  insert into public.circle_contacts(user_id, guide_id) values(auth.uid(), current_setting('test.account_b')) on conflict do nothing;
  select id into strict meeting_id from public.save_check_in(auth.uid(), current_setting('test.account_b'), 'Proposal test', 30,
    now() + interval '2 days', gen_random_uuid()::text);
  perform set_config('test.meeting_id', meeting_id::text, true);
  begin
    perform public.propose_check_in_time(auth.uid(), meeting_id, 1, now() + interval '3 days', 15, gen_random_uuid()::text);
    raise exception 'Sender proposed as recipient';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.account_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.account_b'), 'role', 'authenticated')::text, true);
do $$ declare proposal_id uuid; retry_id uuid; begin
  select id into strict proposal_id from public.propose_check_in_time(auth.uid(), current_setting('test.meeting_id')::uuid,
    1, now() + interval '3 days', 15, 'proposal-test-first');
  perform set_config('test.proposal_id', proposal_id::text, true);
  select id into strict retry_id from public.propose_check_in_time(auth.uid(), current_setting('test.meeting_id')::uuid,
    1, now() + interval '3 days', 15, 'proposal-test-first');
  if proposal_id <> retry_id then raise exception 'Retry duplicated the proposal'; end if;
  if not exists(select 1 from public.check_ins where id = current_setting('test.meeting_id')::uuid
    and starts_at = now() + interval '2 days' and status = 'pending') then
    raise exception 'Proposal changed the original meeting'; end if;
  begin
    perform public.respond_to_check_in_time_proposal(auth.uid(), proposal_id, 'accepted');
    raise exception 'Recipient accepted own proposal';
  exception when insufficient_privilege then null; end;
  begin
    perform public.respond_to_check_in(auth.uid(), current_setting('test.meeting_id')::uuid, 'accepted', 1);
    raise exception 'Recipient accepted original time with pending new-time proposal';
  exception when serialization_failure then null; end;
  begin
    insert into public.check_in_time_proposals(check_in_id, proposer_id, base_revision, starts_at, duration_minutes, client_token)
      values(current_setting('test.meeting_id')::uuid, auth.uid(), 1, now() + interval '3 days', 15, gen_random_uuid()::text);
    raise exception 'Direct proposal writes allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.account_c'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.account_c'), 'role', 'authenticated')::text, true);
do $$ begin
  if exists(select 1 from public.check_in_time_proposals where id = current_setting('test.proposal_id')::uuid) then
    raise exception 'Third party read private proposal'; end if;
  begin
    perform public.respond_to_check_in_time_proposal(auth.uid(), current_setting('test.proposal_id')::uuid, 'accepted');
    raise exception 'Third party accepted proposal';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.account_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.account_a'), 'role', 'authenticated')::text, true);
do $$ begin
  perform public.respond_to_check_in_time_proposal(auth.uid(), current_setting('test.proposal_id')::uuid, 'rejected');
  if not exists(select 1 from public.check_ins where id = current_setting('test.meeting_id')::uuid
    and starts_at = now() + interval '2 days' and status = 'pending') then
    raise exception 'Rejecting proposal changed original meeting'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.account_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.account_b'), 'role', 'authenticated')::text, true);
do $$ declare proposal_id uuid; begin
  select id into strict proposal_id from public.propose_check_in_time(auth.uid(), current_setting('test.meeting_id')::uuid,
    1, now() + interval '4 days', 15, 'proposal-test-second');
  perform set_config('test.proposal_id', proposal_id::text, true);
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.account_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.account_a'), 'role', 'authenticated')::text, true);
do $$ declare result jsonb; begin
  result := public.respond_to_check_in_time_proposal(auth.uid(), current_setting('test.proposal_id')::uuid, 'accepted');
  if result->'check_in'->>'status' <> 'accepted' or (result->'check_in'->>'revision')::integer <> 2 then
    raise exception 'Accepted result did not contain the confirmed meeting'; end if;
  perform public.respond_to_check_in_time_proposal(auth.uid(), current_setting('test.proposal_id')::uuid, 'accepted');
  if not exists(select 1 from public.check_ins where id = current_setting('test.meeting_id')::uuid
    and starts_at = now() + interval '4 days' and duration_minutes = 15 and status = 'accepted' and revision = 2) then
    raise exception 'Acceptance did not atomically update original meeting'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.account_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.account_b'), 'role', 'authenticated')::text, true);
do $$ declare proposal_id uuid; begin
  if not exists(select 1 from public.check_ins where id = current_setting('test.meeting_id')::uuid and starts_at = now() + interval '4 days' and status = 'accepted') then
    raise exception 'Recipient did not receive the accepted new time'; end if;
  -- Create a proposal conflicting with B's own meeting. It is not booked until accepted.
  insert into public.circle_contacts(user_id, guide_id) values(auth.uid(), 'taylor') on conflict do nothing;
  perform public.save_check_in(auth.uid(), 'taylor', 'Conflict', 30, now() + interval '5 days', gen_random_uuid()::text);
  select id into strict proposal_id from public.propose_check_in_time(auth.uid(), current_setting('test.meeting_id')::uuid,
    2, now() + interval '5 days', 15, 'proposal-test-conflict');
  perform set_config('test.proposal_id', proposal_id::text, true);
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.account_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.account_a'), 'role', 'authenticated')::text, true);
do $$ begin
  begin
    perform public.respond_to_check_in_time_proposal(auth.uid(), current_setting('test.proposal_id')::uuid, 'accepted');
    raise exception 'Conflicting new time was accepted';
  exception when exclusion_violation then null; end;
  if not exists(select 1 from public.check_in_time_proposals where id = current_setting('test.proposal_id')::uuid and status = 'pending') then
    raise exception 'Failed acceptance changed proposal status'; end if;
  if not exists(select 1 from public.check_ins where id = current_setting('test.meeting_id')::uuid and starts_at = now() + interval '4 days') then
    raise exception 'Failed acceptance moved the original meeting'; end if;
  -- An independent sender edit invalidates the proposal and makes old approvals stale.
  perform public.save_check_in(auth.uid(), current_setting('test.account_b'), 'Sender edit', 30,
    now() + interval '6 days', gen_random_uuid()::text, current_setting('test.meeting_id')::uuid);
  begin
    perform public.respond_to_check_in_time_proposal(auth.uid(), current_setting('test.proposal_id')::uuid, 'accepted');
    raise exception 'Stale proposal overwrote sender edit';
  exception when serialization_failure then null; end;
  if not exists(select 1 from public.check_in_time_proposals where id = current_setting('test.proposal_id')::uuid and status = 'superseded') then
    raise exception 'Sender edit did not supersede pending proposal'; end if;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  begin
    perform 1 from public.check_in_time_proposals;
    raise exception 'Signed-out proposal read allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: recipient proposals, sender-only decisions, shared accepted time, rejection preservation, retries, conflicts, stale revisions and privacy' as result;
rollback;
