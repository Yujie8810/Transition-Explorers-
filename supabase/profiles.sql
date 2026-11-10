-- Fresh-project prerequisite for migrations/advice.sql.
-- The shared team project already has this table: do not rerun there.
begin;

create table public."Profiles" (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  full_name text,
  major text,
  graduation_year integer,
  current_role text,
  company text,
  bio text,
  avatar_url text
);

alter table public."Profiles" enable row level security;
revoke all on public."Profiles" from public, anon, authenticated;
grant select, insert, update on public."Profiles" to authenticated;

-- Community profiles are visible to signed-in users.
create policy authenticated_users_can_view_profiles
on public."Profiles" for select to authenticated using (true);

-- A user can create or edit only their own profile.
create policy users_can_insert_own_profile
on public."Profiles" for insert to authenticated
with check (auth.uid() = id);

create policy users_can_update_own_profile
on public."Profiles" for update to authenticated
using (auth.uid() = id) with check (auth.uid() = id);

commit;
