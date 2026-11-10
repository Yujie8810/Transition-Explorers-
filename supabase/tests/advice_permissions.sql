-- Run the WHOLE file in Supabase SQL Editor after replacing the two UUIDs.
-- A and B must be distinct, real Auth users who have opened Profile in the app.
-- All fixtures and attempted mutations are rolled back, even on success.
begin;

select set_config('test.account_a', 'REPLACE_WITH_ACCOUNT_A_UUID', true);
select set_config('test.account_b', 'REPLACE_WITH_ACCOUNT_B_UUID', true);

do $$
begin
  if current_setting('test.account_a')::uuid = current_setting('test.account_b')::uuid then
    raise exception 'Use two different accounts';
  end if;
  if (select count(*) from public."Profiles"
      where id in (current_setting('test.account_a')::uuid,
                   current_setting('test.account_b')::uuid)) <> 2 then
    raise exception 'Both accounts need an existing Profiles row';
  end if;
end $$;

-- Every data operation below runs as an ordinary authenticated user.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.account_a'), true);
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('test.account_a'), 'role', 'authenticated')::text, true);

do $$
declare
  public_id uuid;
  anonymous_id uuid;
  saved_id uuid;
  unsaved_id uuid;
begin
  if current_user <> 'authenticated' or auth.uid() is distinct from current_setting('test.account_a')::uuid then
    raise exception 'Account A impersonation failed';
  end if;

  insert into public.questions (title, topic, visibility)
    values ('Permission check public question', 'First job', 'Public') returning id into public_id;
  insert into public.questions (title, topic, visibility)
    values ('Permission check anonymous question', 'First job', 'Anonymous') returning id into anonymous_id;
  insert into public.answers (question_id, body)
    values (public_id, 'Permission check saved answer') returning id into saved_id;
  insert into public.answers (question_id, body)
    values (public_id, 'Permission check unsaved answer') returning id into unsaved_id;
  insert into public.saved_answers (answer_id) values (saved_id);

  perform set_config('test.public_id', public_id::text, true);
  perform set_config('test.anonymous_id', anonymous_id::text, true);
  perform set_config('test.saved_id', saved_id::text, true);
  perform set_config('test.unsaved_id', unsaved_id::text, true);

  -- Positive controls: A can read and edit its questions and read its save.
  if (select count(*) from public.questions where id in (public_id, anonymous_id)) <> 2 then
    raise exception 'A cannot read its own questions';
  end if;
  update public.questions set body = 'Owner edit succeeded' where id in (public_id, anonymous_id);
  if not exists (select 1 from public.saved_answers where user_id = auth.uid() and answer_id = saved_id) then
    raise exception 'A cannot read its own save';
  end if;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.account_b'), true);
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('test.account_b'), 'role', 'authenticated')::text, true);

do $$
declare
  question_id uuid;
  affected integer;
  feed_row jsonb;
begin
  if current_user <> 'authenticated' or auth.uid() is distinct from current_setting('test.account_b')::uuid then
    raise exception 'Account B impersonation failed';
  end if;

  select to_jsonb(f) into feed_row from public.get_question_feed() f
    where f.id = current_setting('test.anonymous_id')::uuid;
  if feed_row is null or not (feed_row ? 'author_id') or feed_row->>'author_id' is not null
      or feed_row->>'author_name' is not null
      or feed_row->>'is_mine' is distinct from 'false' then
    raise exception 'Anonymous feed entry missing, exposes identity, or has wrong ownership';
  end if;
  -- The current RPC has no author_name column; the app adds author_name: null.
  -- B must not bypass the safe feed by reading the anonymous base row.
  if exists (select 1 from public.questions where id = current_setting('test.anonymous_id')::uuid) then
    raise exception 'B can directly read A anonymous question';
  end if;
  if not exists (select 1 from public.questions where id = current_setting('test.public_id')::uuid) then
    raise exception 'B cannot read the public question (positive control)';
  end if;

  foreach question_id in array array[current_setting('test.public_id')::uuid,
                                    current_setting('test.anonymous_id')::uuid] loop
    update public.questions set body = 'Unauthorized edit' where id = question_id;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'B edited A question'; end if;
    delete from public.questions where id = question_id;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'B deleted A question'; end if;
  end loop;

  if exists (select 1 from public.saved_answers where user_id = current_setting('test.account_a')::uuid) then
    raise exception 'B can read A saves';
  end if;
  -- Use an UNSAVED answer so a duplicate-key error cannot masquerade as RLS.
  begin
    insert into public.saved_answers (user_id, answer_id)
      values (current_setting('test.account_a')::uuid, current_setting('test.unsaved_id')::uuid);
    raise exception 'B created a save belonging to A';
  exception when insufficient_privilege then
    null; -- Expected: SQLSTATE 42501, denied by RLS.
  end;
  delete from public.saved_answers
    where user_id = current_setting('test.account_a')::uuid
      and answer_id = current_setting('test.saved_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'B deleted A save'; end if;

  -- B can create/read/delete its OWN save for the same community answer.
  insert into public.saved_answers (answer_id) values (current_setting('test.saved_id')::uuid);
  if not exists (select 1 from public.saved_answers where user_id = auth.uid()
                  and answer_id = current_setting('test.saved_id')::uuid) then
    raise exception 'B cannot read its own save';
  end if;
  delete from public.saved_answers where user_id = auth.uid()
    and answer_id = current_setting('test.saved_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'B cannot delete its own save'; end if;
end $$;

-- Check A's rows survived B's direct requests.
select set_config('request.jwt.claim.sub', current_setting('test.account_a'), true);
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('test.account_a'), 'role', 'authenticated')::text, true);
do $$
begin
  if (select count(*) from public.questions
      where id in (current_setting('test.public_id')::uuid, current_setting('test.anonymous_id')::uuid)
        and author_id = auth.uid() and body = 'Owner edit succeeded') <> 2 then
    raise exception 'A questions changed after B requests';
  end if;
  if not exists (select 1 from public.saved_answers where user_id = auth.uid()
                  and answer_id = current_setting('test.saved_id')::uuid) then
    raise exception 'A save did not survive B requests';
  end if;
end $$;

rollback;
select 'PASS: anonymous feed, question ownership, and private saves; fixtures rolled back' as result;
