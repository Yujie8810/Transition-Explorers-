-- Replace A/B with two real users who have Profiles rows, then run the WHOLE file.
-- Requires circle_contacts.sql. No pgTAP extension is needed.
-- This transaction rolls back fixture inserts AND any temporary fixture deletions.
begin;
select set_config('test.account_a', '0c3db29f-c99c-4620-bf3e-a26a970a29da', true);
select set_config('test.account_b', 'c2165341-932d-4d2f-804f-26fd76b71aaf', true);

do $$
begin
  if current_setting('test.account_a')::uuid = current_setting('test.account_b')::uuid then
    raise exception 'Use two different accounts';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.account_a'), true);
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('test.account_a'), 'role', 'authenticated')::text, true);

do $$
begin
  -- After the check-in integration, remove test-guide plans temporarily so the
  -- new contact-removal guard does not interfere. ROLLBACK restores them all.
  if to_regclass('public.check_ins') is not null then
    execute 'delete from public.check_ins where user_id = auth.uid() and guide_id in (''elena'', ''marcus'')';
  end if;
  -- Start with known fixture rows. Existing contacts are restored by ROLLBACK.
  delete from public.circle_contacts where user_id = auth.uid() and guide_id in ('elena', 'marcus');
  insert into public.circle_contacts (guide_id) values ('elena');
  if not exists (select 1 from public.circle_contacts where user_id = auth.uid() and guide_id = 'elena') then
    raise exception 'A cannot create/read its own contact';
  end if;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.account_b'), true);
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('test.account_b'), 'role', 'authenticated')::text, true);

do $$
declare affected integer;
begin
  if exists (select 1 from public.circle_contacts where user_id = current_setting('test.account_a')::uuid) then
    raise exception 'B can read A contacts';
  end if;
  begin
    -- A has no marcus row in this transaction, avoiding a misleading duplicate error.
    insert into public.circle_contacts (user_id, guide_id)
      values (current_setting('test.account_a')::uuid, 'marcus');
    raise exception 'B created a contact for A';
  exception when insufficient_privilege then null;
  end;
  delete from public.circle_contacts
    where user_id = current_setting('test.account_a')::uuid and guide_id = 'elena';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'B deleted A contact'; end if;

  if to_regclass('public.check_ins') is not null then
    execute 'delete from public.check_ins where user_id = auth.uid() and guide_id = ''elena''';
  end if;
  -- Positive control: both accounts may independently save the same guide.
  delete from public.circle_contacts where user_id = auth.uid() and guide_id = 'elena';
  insert into public.circle_contacts (guide_id) values ('elena');
  if not exists (select 1 from public.circle_contacts where user_id = auth.uid() and guide_id = 'elena') then
    raise exception 'B cannot read its own contact';
  end if;
  delete from public.circle_contacts where user_id = auth.uid() and guide_id = 'elena';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'B cannot delete its own contact'; end if;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.account_a'), true);
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('test.account_a'), 'role', 'authenticated')::text, true);
do $$
begin
  if not exists (select 1 from public.circle_contacts where user_id = auth.uid() and guide_id = 'elena') then
    raise exception 'A contact did not survive B requests';
  end if;
end $$;

-- Signed-out requests must not read contacts, even if they know an owner's UUID.
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform 1 from public.circle_contacts;
    raise exception 'Signed-out role has table access';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
select 'PASS: private Circle contacts and signed-out denial; fixtures rolled back' as result;
