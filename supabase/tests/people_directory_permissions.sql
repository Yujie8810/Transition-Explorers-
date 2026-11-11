-- Replace both UUID placeholders with existing Auth/Profile accounts A and B.
-- Run the WHOLE file after people_directory.sql. All test changes roll back.
begin;
select set_config('test.account_a', '0c3db29f-c99c-4620-bf3e-a26a970a29da', true);
select set_config('test.account_b', 'c2165341-932d-4d2f-804f-26fd76b71aaf', true);
do $$ begin
  if current_setting('test.account_a')::uuid = current_setting('test.account_b')::uuid
    or not exists (select 1 from public."Profiles" where id = current_setting('test.account_a')::uuid)
    or not exists (select 1 from public."Profiles" where id = current_setting('test.account_b')::uuid) then
    raise exception 'Use two different existing Profile accounts';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.account_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.account_b'), 'role', 'authenticated')::text, true);
do $$ declare affected integer; begin
  update public."Profiles" set full_name = 'Directory test graduate',
    current_role = 'Software engineer', expertise = array['Code reviews'], listed_in_people = true
    where id = auth.uid();
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Owner could not publish profile'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.account_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.account_a'), 'role', 'authenticated')::text, true);
do $$ declare affected integer; request_id uuid; check_id uuid; start_time timestamptz; begin
  if not exists (select 1 from public."Profiles" where id = current_setting('test.account_b')::uuid
    and listed_in_people and expertise = array['Code reviews']) then
    raise exception 'A could not discover B';
  end if;
  update public."Profiles" set listed_in_people = false where id = current_setting('test.account_b')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'A changed B directory profile'; end if;
  begin
    insert into public.circle_contacts(user_id, guide_id) values(auth.uid(), gen_random_uuid()::text);
    raise exception 'Unknown real guide was accepted';
  exception when check_violation then null;
  end;
  -- Isolate only this test contact; all existing plans/contacts return on rollback.
  delete from public.check_ins where user_id = auth.uid() and guide_id = current_setting('test.account_b');
  insert into public.circle_contacts(user_id, guide_id) values(auth.uid(), current_setting('test.account_b'))
    on conflict do nothing;
  select id into strict request_id from public.save_guidance_request(auth.uid(), current_setting('test.account_b'),
    'advice', 'Real profile request', gen_random_uuid()::text);
  select greatest(now() + interval '1 day', coalesce(max(ends_at), now()) + interval '1 day')
    into start_time from public.check_ins where user_id = auth.uid();
  select id into strict check_id from public.save_check_in(auth.uid(), current_setting('test.account_b'),
    'Real profile check-in', 15, start_time, gen_random_uuid()::text);
  begin
    delete from public.circle_contacts where user_id = auth.uid() and guide_id = current_setting('test.account_b');
    raise exception 'Upcoming-check-in contact guard was bypassed';
  exception when check_violation then null;
  end;
  delete from public.check_ins where id = check_id;
  delete from public.guidance_requests where id = request_id;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.account_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.account_b'), 'role', 'authenticated')::text, true);
do $$ begin
  update public."Profiles" set listed_in_people = false where id = auth.uid();
  if exists (select 1 from public.circle_contacts where user_id = current_setting('test.account_a')::uuid) then
    raise exception 'B can read A contacts';
  end if;
  if exists (select 1 from public.guidance_requests where user_id = current_setting('test.account_a')::uuid) then
    raise exception 'B can read A requests';
  end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.account_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.account_a'), 'role', 'authenticated')::text, true);
do $$ begin
  if exists (select 1 from public."Profiles" where id = current_setting('test.account_b')::uuid and listed_in_people) then
    raise exception 'B is still listed after opting out';
  end if;
  -- Unlisting must not break an existing contact or its history.
  if not public.is_people_guide(current_setting('test.account_b')) then
    raise exception 'Unlisted profile is no longer a valid existing contact';
  end if;
  if not public.is_people_guide('taylor') then raise exception 'Mock guide stopped working'; end if;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  begin
    perform 1 from public."Profiles";
    raise exception 'Signed-out profile access was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select 'PASS: opt-in discovery, profile ownership, real and mock guides, request/check-in integration, and signed-out denial' as result;
rollback;
