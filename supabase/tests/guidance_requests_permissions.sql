-- Replace both UUIDs with existing Auth/Profile users. Run the WHOLE file.
-- Requires guidance_requests.sql and circle_contacts.sql to be deployed first.
-- All fixtures and any temporarily removed contacts are restored by ROLLBACK.
begin;
select set_config('test.account_a', '0c3db29f-c99c-4620-bf3e-a26a970a29da', true);
select set_config('test.account_b', 'c2165341-932d-4d2f-804f-26fd76b71aaf', true);
select set_config('test.request_token', gen_random_uuid()::text, true);
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
declare first_id uuid; retry_id uuid;
begin
  -- The later check-in integration guards contact removal. Temporarily isolate
  -- these test guides; the final rollback restores plans as well as contacts.
  if to_regclass('public.check_ins') is not null then
    execute 'delete from public.check_ins where user_id = auth.uid() and guide_id in (''elena'', ''marcus'')';
  end if;
  delete from public.circle_contacts where user_id = auth.uid() and guide_id in ('elena', 'marcus');
  select id into strict first_id from public.save_guidance_request(
    auth.uid(), 'elena', 'advice', ' Permission check request ', current_setting('test.request_token'));
  perform set_config('test.request_id', first_id::text, true);
  if not exists (select 1 from public.circle_contacts where user_id = auth.uid() and guide_id = 'elena') then
    raise exception 'RPC did not add the contact';
  end if;
  if not exists (select 1 from public.guidance_requests where id = first_id and message = 'Permission check request') then
    raise exception 'Owner cannot read the normalized request';
  end if;
  select id into strict retry_id from public.save_guidance_request(
    auth.uid(), 'elena', 'advice', 'Permission check request', current_setting('test.request_token'));
  if retry_id <> first_id or (select count(*) from public.guidance_requests
      where user_id = auth.uid() and client_token = current_setting('test.request_token')) <> 1 then
    raise exception 'Retry created a duplicate';
  end if;
  begin
    perform public.save_guidance_request(auth.uid(), 'elena', 'advice',
      'Different content', current_setting('test.request_token'));
    raise exception 'Retry token accepted different content';
  exception when invalid_parameter_value then null;
  end;
  -- A failed request must not leave a contact behind.
  begin
    perform public.save_guidance_request(auth.uid(), 'marcus', 'advice', ' ', gen_random_uuid()::text);
    raise exception 'Blank request accepted';
  exception when check_violation then null;
  end;
  if exists (select 1 from public.circle_contacts where user_id = auth.uid() and guide_id = 'marcus') then
    raise exception 'Failed request left an unwanted contact';
  end if;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.account_b'), true);
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('test.account_b'), 'role', 'authenticated')::text, true);
do $$
declare own_id uuid; affected integer;
begin
  if exists (select 1 from public.guidance_requests where user_id = current_setting('test.account_a')::uuid) then
    raise exception 'B can read A requests';
  end if;
  begin
    insert into public.guidance_requests(user_id, guide_id, kind, message, client_token)
      values (current_setting('test.account_a')::uuid, 'elena', 'advice', 'Forged', gen_random_uuid()::text);
    raise exception 'B inserted a request for A';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_guidance_request(current_setting('test.account_a')::uuid,
      'elena', 'advice', 'Forged RPC', gen_random_uuid()::text);
    raise exception 'RPC accepted the wrong account';
  exception when insufficient_privilege then null;
  end;
  delete from public.guidance_requests where id = current_setting('test.request_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'B dismissed A request'; end if;
  begin
    update public.guidance_requests set user_id = auth.uid()
      where id = current_setting('test.request_id')::uuid;
    raise exception 'Request updates should not be granted';
  exception when insufficient_privilege then null;
  end;

  select id into strict own_id from public.save_guidance_request(
    auth.uid(), 'elena', 'check-in', 'Own request', gen_random_uuid()::text);
  delete from public.guidance_requests where id = own_id;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'B cannot dismiss its own request'; end if;
  if not exists (select 1 from public.circle_contacts where user_id = auth.uid() and guide_id = 'elena') then
    raise exception 'Dismissal removed the contact';
  end if;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.account_a'), true);
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('test.account_a'), 'role', 'authenticated')::text, true);
do $$
begin
  if not exists (select 1 from public.guidance_requests where id = current_setting('test.request_id')::uuid) then
    raise exception 'A request did not survive B requests';
  end if;
end $$;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform 1 from public.guidance_requests;
    raise exception 'Signed-out role can read requests';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_guidance_request(current_setting('test.account_a')::uuid,
      'elena', 'advice', 'Signed-out request', gen_random_uuid()::text);
    raise exception 'Signed-out role can execute the RPC';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
select 'PASS: private guidance requests, contact creation, retries, and signed-out denial; fixtures rolled back' as result;
