# Verify advice database permissions

Run these checks before integrating Circle contacts, guidance requests, or check-ins.
The repository's SQL and mocked tests describe intended behavior; they do not prove
that your Supabase project has those policies deployed.

## 1. Prepare two accounts

1. Run `npm run web` with your project's `.env.local` configured.
2. Create/confirm two test accounts, A and B. Open Profile in each so both have a
   `public."Profiles"` row. Use separate browser profiles or a regular/private window
   so their sessions do not overwrite each other.
3. In Supabase **Authentication → Users**, copy each account's user UUID.
4. Confirm the tables and `get_question_feed` function from
   [`supabase/migrations/advice.sql`](../supabase/migrations/advice.sql) are deployed.
   This is a one-time creation migration; do not rerun it against existing tables.

## 2. Check deployed permissions with direct SQL

Open [`supabase/tests/advice_permissions.sql`](../supabase/tests/advice_permissions.sql).
Copy it into Supabase **SQL Editor**, replace the two `REPLACE_WITH_..._UUID`
values with A and B, and run the **entire file together**.

The script switches to the `authenticated` role and sets each user's identity
inside one transaction. Running a normal query as the SQL Editor's default
privileged role can bypass RLS, so that alone would not verify app permissions.
This follows Supabase's documented
[role/identity testing approach](https://supabase.com/docs/guides/database/postgres/testing-row-level-security).

Expected result: a `PASS` result row and no SQL errors. The final `rollback`
removes every fixture and mutation; do not replace it with `commit`. If a query
fails and the editor leaves an aborted transaction open, run `rollback;` before
trying again. Record the error and resolve it before adding more backend features.

The checks cover:

| Check | Expected as B |
| --- | --- |
| Read A's anonymous question through `get_question_feed()` | Row exists; `author_id` is null; `is_mine` is false |
| Read A's anonymous question directly from `questions` | No row |
| Read A's public question | Row exists |
| Update/delete either of A's questions directly | Zero rows affected; A's content survives |
| Read A's saves | No rows |
| Insert a new save with `user_id = A` | SQLSTATE `42501` (permission/RLS denial) |
| Delete A's save | Zero rows affected; A's save survives |
| Create/read/delete B's own save | Succeeds |

The script also checks A can create, read, and edit its own fixtures. This catches
setups that deny everything rather than enforcing ownership correctly. It uses a
previously unsaved answer for the forbidden insert, so a duplicate constraint
cannot be mistaken for an RLS denial.

For Supabase SDK requests, an unauthorized update/delete can return `error: null`
with an empty result. Check affected rows with `.select('id')` (or
`.select('answer_id')` for saves) and reread as A; a null error alone is not success.
The app's question mutations use `.single()`, which reports an error on zero rows.

## 3. Confirm anonymous output in B's app session

1. As A, publish a throwaway **Anonymous** question with a distinctive title.
2. As B, reload Explore. The question should appear with **Posted anonymously**.
3. In browser developer tools → Network, inspect the `rpc/get_question_feed`
   response for that question. Confirm `author_id: null` and `is_mine: false`.
4. The current SQL function has **no `author_name` column**. `fetchQuestions()` in
   `src/features/advice/adviceApi.ts` adds `author_name: null` and keeps
   `author_id: null` for anonymous rows. To inspect the app result, put a debugger
   breakpoint inside AdviceProvider's `.then(data => ...)` after `fetchQuestions()`
   resolves, reload as B, and inspect that question in `data`.
5. For a public question, verify the app resolves A's profile name. Anonymous
   questions should never trigger a profile lookup using their hidden author ID.

`tests/question-authors.test.cjs` verifies the app mapping with mocked responses,
including a malformed response containing an anonymous identity. Passing that
test does not replace the live SQL or Network check.

## 4. Check persistence in a second browser or device

1. As A in browser/device 1, edit Profile, publish a question, and save an answer
   to a **real database question**. Record the title, answer text, and profile edits.
   If needed, post an answer on that question first.
2. Log into A in browser/device 2, using a fresh browser profile or another device
   with no copied browser/app storage. Open Profile, posted questions, and Saved.
3. Confirm all three records match. Edit the question/profile or remove the save
   on device 2, then **reload** device 1 and verify the changes there. The app uses
   reads on mount/retry; it does not subscribe to realtime updates.
4. Log in as B and confirm A's questions are absent from B's **posted questions**
   list and A's saves are absent from Saved. A's questions remain community feed
   content, with anonymous identity hidden.
5. Delete your throwaway question as A when finished.

Saves of fictional seeded answers intentionally remain local and will not appear
on device 2. Circle contacts, guidance requests, and check-ins also remain local,
separated by account ID. Do not use those as the cross-device success criteria.

## Record results

All live checks below are **pending** until someone runs them on the team's project.
Add the tester, date, platform, and observed result when completed. Do not attach
passwords, access tokens, or private keys.

| Verification | Status |
| --- | --- |
| SQL ownership, anonymity, and saves assertions | Pending |
| B's actual app/Network anonymous response | Pending |
| A's profile/questions/real saves on a second device | Pending |
| Physical-phone flow | Pending |

After these pass, integrate Circle contacts, then guidance requests, then check-ins
with their own ownership policies and live two-account checks.
