-- Run ONCE after check_ins.sql on the existing team project.
-- Keep fictional guides and add opt-in real account profiles without re-creating tables.
begin;
alter table public."Profiles"
  add column listed_in_people boolean not null default false,
  add column expertise text[] not null default '{}';
alter table public."Profiles"
  add constraint profiles_directory_role check (
    not listed_in_people or (char_length(trim(full_name)) between 1 and 80
      and full_name is not null and current_role is not null
      and char_length(trim(current_role)) between 1 and 120)),
  add constraint profiles_expertise_count check (cardinality(expertise) <= 10);

-- Profiles already has authenticated SELECT and owner-only INSERT/UPDATE RLS.
-- Directory visibility is an opt-in discovery preference, not a privacy boundary
-- or verified graduate role. Existing contacts can still resolve an unlisted user.
create function public.is_people_guide(p_guide_id text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select p_guide_id in ('taylor', 'anika', 'jordan', 'priya', 'sam', 'marcus', 'elena')
    or exists (select 1 from public."Profiles" where id::text = p_guide_id);
$$;
revoke all on function public.is_people_guide(text) from public, anon, authenticated;
grant execute on function public.is_people_guide(text) to authenticated;

-- Replaces only the old fictional-ID checks. Ownership RLS, request atomicity,
-- retry tokens, overlap exclusion and contact-removal guards remain in force.
alter table public.circle_contacts drop constraint circle_contacts_guide_id_check;
alter table public.circle_contacts add constraint circle_contacts_guide_id_check
  check (public.is_people_guide(guide_id));
alter table public.guidance_requests drop constraint guidance_requests_guide_id_check;
alter table public.guidance_requests add constraint guidance_requests_guide_id_check
  check (public.is_people_guide(guide_id));
alter table public.check_ins drop constraint check_ins_guide_id_check;
alter table public.check_ins add constraint check_ins_guide_id_check
  check (public.is_people_guide(guide_id));
-- Guide IDs stay text to preserve all existing demo contacts/requests/history.
-- Account deletion may leave an unavailable graduate reference in another user's
-- private history. No directory listing automatically delivers requests.
commit;
