-- Replace A/B UUIDs, then run the WHOLE file after deploying check_ins.sql.
-- Temporarily clears these two test accounts' plans to isolate schedule tests.
-- ALL deletions, inserts, edits, and contact changes are restored by ROLLBACK.
begin;
select set_config('test.account_a', '0c3db29f-c99c-4620-bf3e-a26a970a29da', true);
select set_config('test.account_b', 'c2165341-932d-4d2f-804f-26fd76b71aaf', true);
select set_config('test.starts_at', (date_trunc('hour', now()) + interval '7 days')::text, true);
select set_config('test.check_in_token', gen_random_uuid()::text, true);
do $$
begin
  if current_setting('test.account_a')::uuid = current_setting('test.account_b')::uuid then
    raise exception 'Use different accounts';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.account_a'), true);
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('test.account_a'), 'role', 'authenticated')::text, true);
do $$
declare saved_id uuid; retry_id uuid; second_id uuid; starts timestamptz := current_setting('test.starts_at')::timestamptz;
begin
  delete from public.check_ins where user_id = auth.uid();
  insert into public.circle_contacts(guide_id) values ('elena') on conflict do nothing;
  delete from public.circle_contacts where user_id = auth.uid() and guide_id = 'marcus';

  select id into strict saved_id from public.save_check_in(auth.uid(), 'elena', ' First plan ',
    30, starts, current_setting('test.check_in_token'));
  perform set_config('test.check_in_id', saved_id::text, true);
  if not exists (select 1 from public.check_ins where id = saved_id and topic = 'First plan'
      and ends_at = starts + interval '30 minutes') then
    raise exception 'Owner read, topic normalization, or computed end time failed';
  end if;
  select id into strict retry_id from public.save_check_in(auth.uid(), 'elena', 'First plan',
    30, starts, current_setting('test.check_in_token'));
  if retry_id <> saved_id or (select count(*) from public.check_ins where user_id = auth.uid()) <> 1 then
    raise exception 'Retry created a duplicate';
  end if;
  begin
    perform public.save_check_in(auth.uid(), 'elena', 'Different content',
      30, starts, current_setting('test.check_in_token'));
    raise exception 'Retry token accepted changed content';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_check_in(auth.uid(), 'elena', 'Overlapping plan',
      15, starts + interval '5 minutes', gen_random_uuid()::text);
    raise exception 'Database accepted an overlap';
  exception when exclusion_violation then null; -- SQLSTATE 23P01
  end;
  -- Exactly adjacent appointments are allowed by [start,end) ranges.
  select id into strict second_id from public.save_check_in(auth.uid(), 'elena', 'Adjacent plan',
    15, starts + interval '30 minutes', gen_random_uuid()::text);

  begin
    perform public.save_check_in(auth.uid(), 'elena', 'Past plan', 15, now() - interval '1 day', gen_random_uuid()::text);
    raise exception 'Database accepted a past plan';
  exception when check_violation then null;
  end;
  begin
    perform public.save_check_in(auth.uid(), 'elena', 'Bad duration', 45, starts + interval '4 hours', gen_random_uuid()::text);
    raise exception 'Database accepted an invalid duration';
  exception when check_violation then null;
  end;
  begin
    perform public.save_check_in(auth.uid(), 'marcus', 'Missing contact', 15, starts + interval '4 hours', gen_random_uuid()::text);
    raise exception 'Database accepted a missing contact';
  exception when foreign_key_violation then null;
  end;
  begin
    delete from public.circle_contacts where user_id = auth.uid() and guide_id = 'elena';
    raise exception 'Database allowed removal with an upcoming check-in';
  exception when check_violation then null;
  end;
  -- An edit keeps the same ID and is subject to the same server validation.
  perform public.save_check_in(auth.uid(), 'elena', 'Rescheduled plan', 15,
    starts + interval '2 hours', 'unused-on-edit', saved_id);
  if not exists (select 1 from public.check_ins where id = saved_id
      and starts_at = starts + interval '2 hours' and topic = 'Rescheduled plan') then
    raise exception 'Owner rescheduling failed';
  end if;
  update public.check_ins set ends_at = starts_at + interval '1 minute' where id = saved_id;
  if not exists (select 1 from public.check_ins where id = saved_id and ends_at = starts_at + interval '15 minutes') then
    raise exception 'A client forged the computed end time';
  end if;
  begin
    update public.check_ins set user_id = current_setting('test.account_b')::uuid where id = saved_id;
    raise exception 'Owner reassigned a check-in';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.account_b'), true);
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('test.account_b'), 'role', 'authenticated')::text, true);
do $$
declare own_id uuid; affected integer;
begin
  delete from public.check_ins where user_id = auth.uid();
  if exists (select 1 from public.check_ins where user_id = current_setting('test.account_a')::uuid) then
    raise exception 'B can read A check-ins';
  end if;
  begin
    insert into public.check_ins(user_id, guide_id, topic, duration_minutes, starts_at, client_token)
      values (current_setting('test.account_a')::uuid, 'elena', 'Forged owner', 15,
        current_setting('test.starts_at')::timestamptz, gen_random_uuid()::text);
    raise exception 'B created a check-in for A';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_check_in(current_setting('test.account_a')::uuid, 'elena', 'Forged RPC', 15,
      current_setting('test.starts_at')::timestamptz, gen_random_uuid()::text);
    raise exception 'RPC accepted a forged owner';
  exception when insufficient_privilege then null;
  end;
  update public.check_ins set topic = 'Unauthorized edit' where id = current_setting('test.check_in_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'B edited A plan'; end if;
  delete from public.check_ins where id = current_setting('test.check_in_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'B cancelled A plan'; end if;
  begin
    perform public.save_check_in(auth.uid(), 'elena', 'Unauthorized reschedule', 15,
      current_setting('test.starts_at')::timestamptz, 'unused', current_setting('test.check_in_id')::uuid);
    raise exception 'B rescheduled A plan through the RPC';
  exception when no_data_found then null;
  end;
  insert into public.circle_contacts(guide_id) values ('elena') on conflict do nothing;
  -- Different accounts may use the same time slot independently.
  select id into strict own_id from public.save_check_in(auth.uid(), 'elena', 'B plan', 15,
    current_setting('test.starts_at')::timestamptz + interval '2 hours', gen_random_uuid()::text);
  delete from public.check_ins where id = own_id;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'B cannot cancel its own plan'; end if;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.account_a'), true);
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('test.account_a'), 'role', 'authenticated')::text, true);
do $$
begin
  if not exists (select 1 from public.check_ins where id = current_setting('test.check_in_id')::uuid
      and topic = 'Rescheduled plan') then raise exception 'A plan did not survive B requests'; end if;
  delete from public.check_ins where user_id = auth.uid();
  delete from public.circle_contacts where user_id = auth.uid() and guide_id = 'elena';
  if exists (select 1 from public.circle_contacts where user_id = auth.uid() and guide_id = 'elena') then
    raise exception 'Contact removal failed after cancellation';
  end if;
end $$;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform 1 from public.check_ins;
    raise exception 'Signed-out role can read check-ins';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_check_in(current_setting('test.account_a')::uuid, 'elena', 'Signed-out plan', 15,
      current_setting('test.starts_at')::timestamptz, gen_random_uuid()::text);
    raise exception 'Signed-out role can execute the RPC';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
select 'PASS: private check-ins, rescheduling, cancellation, overlaps, retries, and contact guard; fixtures rolled back' as result;
