-- Run ONCE in Supabase SQL Editor, after public."Profiles" exists.
-- Saving this file in the repository does not deploy it to Supabase.
begin;

create table public.circle_contacts (
  -- This UUID is the signed-in account that owns the private contact list.
  user_id uuid not null default auth.uid()
    references public."Profiles"(id) on delete cascade,

  -- People still displays fictional guides, whose IDs are text, not Auth UUIDs.
  -- Do not reference Profiles with these IDs. When People moves to real profiles,
  -- migrate this column and its constraint to a profile foreign key separately.
  guide_id text not null check (guide_id in (
    'taylor', 'anika', 'jordan', 'priya', 'sam', 'marcus', 'elena'
  )),
  created_at timestamptz not null default now(),

  -- A may add Taylor and B may add Taylor, but A cannot add Taylor twice.
  -- The leading user_id also indexes the usual "load my contacts" query.
  primary key (user_id, guide_id)
);

alter table public.circle_contacts enable row level security;

-- An app key alone grants no access; a signed-in session is required.
revoke all on public.circle_contacts from public, anon, authenticated;
grant select, insert, delete on public.circle_contacts to authenticated;

-- SELECT/DELETE filter existing rows. INSERT checks the proposed new owner.
-- Supplying someone else's user_id in a direct request cannot bypass these rules.
create policy circle_contacts_read on public.circle_contacts
  for select to authenticated using (user_id = (select auth.uid()));
create policy circle_contacts_insert on public.circle_contacts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy circle_contacts_delete on public.circle_contacts
  for delete to authenticated using (user_id = (select auth.uid()));

-- There is no UPDATE grant/policy: contacts are added or removed, never reassigned.
commit;
