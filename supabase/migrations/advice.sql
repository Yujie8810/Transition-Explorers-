begin;

-- Shared questions.
-- Supabase generates IDs and timestamps; the client does not invent them.
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid()
    references public."Profiles"(id) on delete cascade,

  title text not null
    check (char_length(trim(title)) between 10 and 150),

  body text not null default ''
    check (char_length(body) <= 1000),

  topic text not null
    check (topic in ('First job', 'Interviews', 'Work life')),

  visibility text not null default 'Public'
    check (visibility in ('Public', 'Anonymous')),

  -- Deleting the original leaves its follow-ups as independent questions.
  follow_up_of uuid
    references public.questions(id) on delete set null,

  created_at timestamptz not null default now()
);

-- Each answer belongs to a question and a real profile.
create table public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null
    references public.questions(id) on delete cascade,

  author_id uuid not null default auth.uid()
    references public."Profiles"(id) on delete cascade,

  body text not null
    check (char_length(trim(body)) between 1 and 5000),

  created_at timestamptz not null default now()
);

-- A save links a user to an answer; it does not copy the answer text.
create table public.saved_answers (
  user_id uuid not null default auth.uid()
    references public."Profiles"(id) on delete cascade,

  answer_id uuid not null
    references public.answers(id) on delete cascade,

  created_at timestamptz not null default now(),

  -- A user cannot save the same answer twice.
  primary key (user_id, answer_id)
);

-- Index columns used for ownership checks and common lookups.
create index questions_author_idx on public.questions(author_id);
create index questions_created_idx on public.questions(created_at desc);
create index questions_follow_up_idx on public.questions(follow_up_of);
create index answers_question_idx on public.answers(question_id);
create index answers_author_idx on public.answers(author_id);
create index saved_answers_answer_idx on public.saved_answers(answer_id);

alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.saved_answers enable row level security;

-- Make access explicit: signed-out users get no table access.
revoke all on public.questions, public.answers, public.saved_answers
from anon, authenticated, public;

grant select, insert, update, delete
on public.questions, public.answers to authenticated;

grant select, insert, delete
on public.saved_answers to authenticated;

-- Public questions can be read directly.
-- Anonymous rows are directly readable only by their owner.
-- Other users read anonymous questions through the safe feed function below.
create policy questions_read
on public.questions for select to authenticated
using (visibility = 'Public' or author_id = auth.uid());

create policy questions_insert
on public.questions for insert to authenticated
with check (author_id = auth.uid());

create policy questions_update
on public.questions for update to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

create policy questions_delete
on public.questions for delete to authenticated
using (author_id = auth.uid());

-- Answers are community content; only their author can change them.
create policy answers_read
on public.answers for select to authenticated
using (true);

create policy answers_insert
on public.answers for insert to authenticated
with check (author_id = auth.uid());

create policy answers_update
on public.answers for update to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

create policy answers_delete
on public.answers for delete to authenticated
using (author_id = auth.uid());

-- Saved answers are private to their owner.
create policy saves_read
on public.saved_answers for select to authenticated
using (user_id = auth.uid());

create policy saves_insert
on public.saved_answers for insert to authenticated
with check (user_id = auth.uid());

create policy saves_delete
on public.saved_answers for delete to authenticated
using (user_id = auth.uid());

-- This function deliberately reads across question ownership boundaries.
-- It returns community content while withholding anonymous author IDs.
create function public.get_question_feed()
returns table (
  id uuid,
  title text,
  body text,
  topic text,
  visibility text,
  follow_up_of uuid,
  created_at timestamptz,
  author_id uuid,
  is_mine boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    q.id,
    q.title,
    q.body,
    q.topic,
    q.visibility,
    q.follow_up_of,
    q.created_at,
    case
      when q.visibility = 'Anonymous' then null::uuid
      else q.author_id
    end,
    q.author_id = auth.uid()
  from public.questions q
  -- Also reject signed-out callers inside the function.
  where auth.uid() is not null
  order by q.created_at desc, q.id;
$$;

-- Functions otherwise receive PUBLIC execution permission by default.
revoke all on function public.get_question_feed()
from public, anon, authenticated;

grant execute on function public.get_question_feed()
to authenticated;

commit;