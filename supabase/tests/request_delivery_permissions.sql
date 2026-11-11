-- Run the WHOLE file after request_delivery.sql. Replace A/B with existing
-- account/Profile UUIDs. Every fixture and temporary calendar change rolls back.
begin;
select set_config('test.account_a', '0c3db29f-c99c-4620-bf3e-a26a970a29da', true);
select set_config('test.account_b', 'c2165341-932d-4d2f-804f-26fd76b71aaf', true);
select set_config('test.account_c', gen_random_uuid()::text, true);
do $$ begin
  if current_setting('test.account_a')::uuid = current_setting('test.account_b')::uuid
    or not exists(select 1 from public."Profiles" where id = current_setting('test.account_a')::uuid)
    or not exists(select 1 from public."Profiles" where id = current_setting('test.account_b')::uuid) then
    raise exception 'Use two different existing accounts with Profile rows';
  end if;
end $$;
-- Isolate the test calendars. ROLLBACK restores all existing plans/bookings.
delete from public.check_ins where user_id in (current_setting('test.account_a')::uuid, current_setting('test.account_b')::uuid)
  or recipient_id in (current_setting('test.account_a')::uuid, current_setting('test.account_b')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.account_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.account_a'), 'role', 'authenticated')::text, true);
do $$ declare created_request_id uuid; invite_id uuid; begin
  begin
    insert into public.circle_contacts(user_id, guide_id) values(auth.uid(), auth.uid()::text);
    raise exception 'Self contact accepted';
  exception when check_violation then null; end;
  begin
    perform public.save_guidance_request(auth.uid(), auth.uid()::text, 'advice', 'Self', gen_random_uuid()::text);
    raise exception 'Self request accepted';
  exception when check_violation then null; end;
  select id into strict created_request_id from public.save_guidance_request(auth.uid(), current_setting('test.account_b'),
    'advice', 'Can you review my resume?', gen_random_uuid()::text);
  perform set_config('test.request_id', created_request_id::text, true);
  select id into strict invite_id from public.save_check_in(auth.uid(), current_setting('test.account_b'),
    'Resume discussion', 30, now() + interval '2 days', gen_random_uuid()::text);
  perform set_config('test.invite_id', invite_id::text, true);
  if not exists(select 1 from public.check_ins where id = invite_id and status = 'pending' and delivered_at is not null) then
    raise exception 'Real check-in was not delivered as pending'; end if;
  begin
    perform public.respond_to_check_in(auth.uid(), invite_id, 'accepted', 1);
    raise exception 'Sender accepted own invitation';
  exception when insufficient_privilege then null; end;
  begin
    perform public.respond_to_guidance_request(auth.uid(), created_request_id, 'answered', 'Forged answer');
    raise exception 'Sender answered own request as recipient';
  exception when insufficient_privilege then null; end;
  begin
    update public.check_ins set status = 'accepted' where id = invite_id;
    raise exception 'Direct status update allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.guidance_messages(request_id, sender_id, body, client_token)
      values(created_request_id, current_setting('test.account_b')::uuid, 'Forged', gen_random_uuid()::text);
    raise exception 'Direct forged message allowed';
  exception when insufficient_privilege then null; end;
  perform public.hide_guidance_request(auth.uid(), created_request_id);
end $$;
-- An unrelated authenticated identity cannot read or mutate either participant's data.
select set_config('request.jwt.claim.sub', current_setting('test.account_c'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.account_c'), 'role', 'authenticated')::text, true);
do $$ begin
  if exists(select 1 from public.guidance_requests where id = current_setting('test.request_id')::uuid)
    or exists(select 1 from public.check_ins where id = current_setting('test.invite_id')::uuid) then
    raise exception 'Third party read participant records'; end if;
  begin
    perform public.send_guidance_message(auth.uid(), current_setting('test.request_id')::uuid, 'Intruder', gen_random_uuid()::text);
    raise exception 'Third party sent a message';
  exception when insufficient_privilege then null; end;
  begin
    perform public.respond_to_check_in(auth.uid(), current_setting('test.invite_id')::uuid, 'declined', 1);
    raise exception 'Third party changed a decision';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.account_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.account_b'), 'role', 'authenticated')::text, true);
do $$ declare first_message uuid; retry_message uuid; invite public.check_ins%rowtype; affected integer; begin
  if not exists(select 1 from public.guidance_requests where id = current_setting('test.request_id')::uuid and sender_hidden) then
    raise exception 'Recipient lost a hidden conversation'; end if;
  select id into strict first_message from public.send_guidance_message(auth.uid(), current_setting('test.request_id')::uuid, 'Happy to help.', 'delivery-test-message');
  select id into strict retry_message from public.send_guidance_message(auth.uid(), current_setting('test.request_id')::uuid, 'Happy to help.', 'delivery-test-message');
  if first_message <> retry_message then raise exception 'Message retry duplicated'; end if;
  begin
    perform public.send_guidance_message(auth.uid(), current_setting('test.request_id')::uuid, 'Different body', 'delivery-test-message');
    raise exception 'Message token accepted different text';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.send_guidance_message(auth.uid(), current_setting('test.request_id')::uuid, ' ', gen_random_uuid()::text);
    raise exception 'Blank chat message accepted';
  exception when invalid_parameter_value then null; end;
  delete from public.guidance_requests where id = current_setting('test.request_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Recipient deleted shared request'; end if;
  select * into strict invite from public.respond_to_check_in(auth.uid(), current_setting('test.invite_id')::uuid, 'accepted', 1);
  if invite.status <> 'accepted' then raise exception 'Acceptance did not persist'; end if;
  -- Identical lost-response retries are safe.
  perform public.respond_to_check_in(auth.uid(), invite.id, 'accepted', 1);
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.account_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.account_a'), 'role', 'authenticated')::text, true);
do $$ declare invite public.check_ins%rowtype; affected integer; begin
  if not exists(select 1 from public.guidance_messages where request_id = current_setting('test.request_id')::uuid and body = 'Happy to help.') then
    raise exception 'Sender did not receive chat reply'; end if;
  if not exists(select 1 from public.guidance_requests where id = current_setting('test.request_id')::uuid and not sender_hidden and status = 'answered') then
    raise exception 'Recipient reply did not restore sender conversation'; end if;
  perform public.send_guidance_message(auth.uid(), current_setting('test.request_id')::uuid, 'Thank you!', gen_random_uuid()::text);
  if not exists(select 1 from public.check_ins where id = current_setting('test.invite_id')::uuid and status = 'accepted') then
    raise exception 'Sender did not receive acceptance'; end if;
  delete from public.check_ins where id = current_setting('test.invite_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Sender hard-deleted shared invitation'; end if;
  select * into strict invite from public.save_check_in(auth.uid(), current_setting('test.account_b'),
    'New time', 30, now() + interval '3 days', gen_random_uuid()::text, current_setting('test.invite_id')::uuid);
  if invite.status <> 'pending' or invite.revision <> 2 then raise exception 'Reschedule retained acceptance'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.account_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.account_b'), 'role', 'authenticated')::text, true);
do $$ declare personal_id uuid; begin
  if not exists(select 1 from public.guidance_messages where request_id = current_setting('test.request_id')::uuid and body = 'Thank you!') then
    raise exception 'Recipient did not receive sender follow-up'; end if;
  begin
    perform public.respond_to_check_in(auth.uid(), current_setting('test.invite_id')::uuid, 'accepted', 1);
    raise exception 'Stale acceptance approved new time';
  exception when serialization_failure then null; end;
  insert into public.circle_contacts(user_id, guide_id) values(auth.uid(), 'taylor') on conflict do nothing;
  select id into strict personal_id from public.save_check_in(auth.uid(), 'taylor', 'Conflicting personal plan', 30,
    now() + interval '3 days', gen_random_uuid()::text);
  begin
    perform public.respond_to_check_in(auth.uid(), current_setting('test.invite_id')::uuid, 'accepted', 2);
    raise exception 'Recipient calendar overlap accepted';
  exception when exclusion_violation then null; end;
  perform public.cancel_check_in(auth.uid(), personal_id);
  perform public.respond_to_check_in(auth.uid(), current_setting('test.invite_id')::uuid, 'declined', 2);
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.account_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.account_a'), 'role', 'authenticated')::text, true);
do $$ begin
  if not exists(select 1 from public.check_ins where id = current_setting('test.invite_id')::uuid and status = 'declined') then
    raise exception 'Sender did not receive decline'; end if;
  perform public.cancel_check_in(auth.uid(), current_setting('test.invite_id')::uuid);
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.account_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.account_b'), 'role', 'authenticated')::text, true);
do $$ begin
  if not exists(select 1 from public.check_ins where id = current_setting('test.invite_id')::uuid and status = 'cancelled') then
    raise exception 'Recipient did not receive cancellation'; end if;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  begin
    perform 1 from public.guidance_messages;
    raise exception 'Signed-out chat read allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.send_guidance_message(null, current_setting('test.request_id')::uuid, 'Signed out', 'anon-token');
    raise exception 'Signed-out chat write allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: self guards, private two-way chat, recipient-only decisions, idempotent retries, reschedule revisions, calendar conflicts and shared cancellation' as result;
rollback;
