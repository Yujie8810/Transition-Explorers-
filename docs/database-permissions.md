# Verify database permissions

For a first test run, start with the [teammate database testing guide](teammate-database-testing.md).
It covers app setup, account UUIDs, the exact scripts to run and how to record results.

Backend wiring is complete and developer-reported working on the shared project.
This is a verification checklist, not a list of unfinished integrations. See the
[evidence record](backend-status.md) for reported app/SQL results. Successful UI
flows and mocked tests do not prove every deployed authorization rule.

## Current SQL check selection

Use two existing Auth/Profile accounts and run each selected script as a whole,
including its final rollback. The scripts simulate ordinary authenticated roles;
admin dashboard reads alone do not test RLS. Do not rerun creation migrations.

| Script | Current use / recorded result |
| --- | --- |
| [advice_permissions.sql](../supabase/tests/advice_permissions.sql) | Ownership, anonymity and private saves; recorded PASS |
| [circle_contacts_permissions.sql](../supabase/tests/circle_contacts_permissions.sql) | Private contact operations; recorded PASS |
| [guidance_requests_permissions.sql](../supabase/tests/guidance_requests_permissions.sql) | Initial demo/private request storage; recorded PASS, not a complete test of delivered chat |
| [people_directory_permissions.sql](../supabase/tests/people_directory_permissions.sql) | Profile opt-in, ownership and real guide IDs; separate PASS not recorded |
| [request_delivery_permissions.sql](../supabase/tests/request_delivery_permissions.sql) | Participant chat/privacy, invitation decisions and bookings; separate PASS not recorded |
| [check_in_time_proposals_permissions.sql](../supabase/tests/check_in_time_proposals_permissions.sql) | Recipient proposals, sender decisions, shared updates and stale/conflict protection; separate PASS not recorded |

The baseline `check_ins_permissions.sql` passed by developer report before shared
invitations were added. Its direct INSERT/UPDATE assumptions are superseded by the
delivery migration; use the two current delivery/proposal scripts for current
check-in permissions. Earlier PASS results do not certify later policies.

The remaining sections retain the detailed advice-specific procedure.

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
trying again. Record and resolve any error before considering that permission check passed.

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

Saves of fictional seeded answers intentionally stay device-local. All real Circle
features now use Supabase: contacts, private chat/inbox, scheduled invitations and
recipient time proposals are developer-reported working. Circle/chat updates every
five seconds while open, as well as on focus/foreground/manual refresh. Advice,
profile and saved-data persistence should still be checked through their own
reload/refresh paths rather than assuming Circle polling refreshes everything.

## Record results

Record tester, date, platform, script/version and observed result. Never attach
passwords, access tokens or private keys. Keep fixtures rollback-only.

The [central verification record](backend-status.md) contains current results:
prior advice/contact/request SQL evidence, the reported baseline check-in PASS,
screenshot-backed live chat/declines, and the reported working proposal flow.
Separate PASS results for directory/delivery/proposal checks have not been
reported. Cross-account answer mutations, broader signed-out access, live
concurrency, confirmation/session edge cases and the final physical-phone rehearsal
remain QA items unless the team records their completion.
