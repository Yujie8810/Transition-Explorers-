# Teammate guide: test the Supabase database

Use this guide to check the working team backend yourself. You can test normal
app behavior without dashboard access. To run the SQL permissions checks, you
also need access to the team's Supabase project and SQL Editor.

**Use the existing shared project. Do not run files in `supabase/migrations/` or
`supabase/profiles.sql` just to test it.** Those create/change the schema and are
already applied for the working app. Fresh-project setup is a separate procedure
in the [README](../README.md#supabase-authentication-setup).

## 1. Run the current app

1. Open the current team branch in the repository folder. Get the latest agreed
   code before testing; don't discard uncommitted work to update your checkout.
2. Run:

   ```sh
   npm ci
   ```

3. If you don't already have `.env.local`, copy `.env.example` to that name. Ask
   the backend coordinator for the shared project's URL and publishable app key,
   then set:

   ```dotenv
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
   ```

   Use the team's actual values. A publishable key is for the app; do not use an
   admin/service-role/secret key. Keep `.env.local` out of Git.
4. Start the browser app:

   ```sh
   npm run web
   ```

   For phone/Expo Go setup, use the [README running options](../README.md#choose-how-to-run-the-app).
   Restart Expo after changing the environment; use `npx expo start --clear` if
   the app is running stale code.

## 2. Prepare two separate test sessions

Use two dedicated test accounts called **A (sender)** and **B (graduate)** below.
Use email addresses you control and complete confirmation if the project requires
it. Avoid using a teammate's everyday account for SQL fixture tests.

1. Sign up/sign in as A in one browser profile and B in a different browser profile,
   private window, or second device. Two ordinary tabs in one browser profile share
   login storage and are not independent sessions.
2. Open **Profile** in each account and wait for it to load. This creates the
   `public."Profiles"` row if missing.
3. In B: **Edit profile → Graduate → Save profile**. Under **Your People profile**,
   choose **Edit People profile**, enter a role and expertise, enable **Appear in
   People**, then save. Use an easy-to-find test name, such as `TEST Graduate B`.
4. In A: open **People**, refresh, and find B's real listing. Use real test accounts
   for the tests below; the seven fictional graduates cannot receive messages.
5. Give test questions/topics a distinctive prefix such as `TEST YourName Nov10`.
   Choose future check-in times without existing meetings.

Circle and chat update approximately every five seconds while the screen is open,
plus on focus/returning to the foreground. You can use **Refresh Circle** or
**Refresh conversation**. For People, use **Refresh people**. Advice/Profile/Saved
use their own reload/refresh paths; don't assume Circle polling refreshes them.

## 3. Test normal app behavior against the database

These actions save real records. The SQL tests in the next section roll their
fixtures back; normal app actions here persist until you remove/hide/cancel them.

| Test | What to do | Expected result |
| --- | --- | --- |
| Account/profile | As A, edit your name/program, save, then sign out/in or use a second device signed into A. | Saved details return. A and B retain separate account data. |
| Public question | A posts a Public question through Ask review/confirmation. B reloads Explore. | B sees it with A's public author name. It appears only in A's owned-question list. |
| Anonymous question | A posts Anonymous; B reloads Explore. | B sees Posted anonymously. To inspect server identity masking, follow the [Network-response instructions](database-permissions.md#3-confirm-anonymous-output-in-bs-app-session). |
| Real answers | B opens A's database question and posts an answer; A refreshes answers. | Both see the answer, author byline and updated count. |
| Remote saves | A saves B's real answer, then signs into A on another device. Test Remove/Undo and reload. | Saves persist for A; B's Saved list does not inherit A's saves. |
| People and self-actions | A opens B's profile; B opens their own listing. | A can add/request B. B sees Edit your profile instead of self-contact/request actions. |
| Contacts | A adds B, reloads/reopens Circle, then checks another device signed into A. | B appears once in A's private contacts. B does not automatically get A's contact list. |
| Guidance chat | A requests advice from B. B opens Circle → Requests received → Open chat and replies. A opens Your guidance requests → Open chat and responds again. | Both see the original request and exchanged messages with correct names/bubble directions. |
| Scheduled acceptance | A schedules B from Circle, reviews the date/time/duration and sends. B accepts under Check-in invitations received. | Both see Accepted at the same instant in their local time zones; the meeting appears in upcoming check-ins. |
| Scheduled decline | Send a separate invitation and have B decline it. | B sees Declined; A sees the same decision under declined/cancelled check-ins. |
| Recipient new-time proposal | On an invitation, B chooses Reschedule and propose a new time, picks another future time/duration, reviews and sends. | The original time stays unchanged. A sees the proposed time with Accept new time / Reject new time. |
| Reject a proposal | A chooses Reject new time. | B sees the rejection; the original meeting's time and status stay unchanged. |
| Accept a proposal | B sends another proposal; A chooses Accept new time. | Both see the proposed time/duration as the accepted meeting. Reopen Circle to confirm persistence. |
| Sender edit/cancel | A edits an invitation while B has an older screen open, then separately tests cancellation. | Editing requires B to accept the changed invitation. Old decisions/proposals cannot override newer details. Cancellation appears for B. |
| Calendar conflicts | Give B a personal/accepted meeting, then attempt acceptance of an overlapping invitation/proposal. Also try an adjacent time. | Overlap fails without a partial decision/time change. Back-to-back meetings are allowed. |
| Contact removal guard | A tries removing B with an active upcoming check-in, then cancels it and retries. | Removal is blocked while the active plan exists, and succeeds once no blocking plan remains. |

For a failed-send check, type a chat draft, disconnect the network and send. The
screen should retain the draft and show an error. Reconnect and retry once; verify
one new message on both accounts. Keep that screen mounted while retrying. If you
reload after an uncertain send, check the conversation before manually resending.

For an account-isolation check, switch accounts and confirm private contacts,
saves and unrelated conversations don't carry over. Participant-shared requests
and invitations are intentionally visible to both A and B. Use the SQL checks
below to verify server permissions, rather than attempting to bypass the app UI.

## 4. Run the SQL permissions checks

Skip this section if you don't have dashboard access; ask the coordinator to run
it and share the PASS/error result. App testing does not require adding a database
password or admin key to the app.

### Get A and B's real account IDs

1. Open the team's Supabase project and **Authentication → Users**.
2. Find the two test accounts and copy their full user UUIDs.
3. Confirm both have a matching row in the case-sensitive **public.Profiles**
   table. If not, open Profile in the app with that account and retry.

### Choose the scripts

For the current complete app, run these scripts **one at a time**, in this order:

| Order | File | What it verifies |
| --- | --- | --- |
| 1 | [advice_permissions.sql](../supabase/tests/advice_permissions.sql) | Anonymous-feed masking, question ownership and private saves |
| 2 | [circle_contacts_permissions.sql](../supabase/tests/circle_contacts_permissions.sql) | Private contacts, valid own operations and forged-owner denial |
| 3 | [guidance_requests_permissions.sql](../supabase/tests/guidance_requests_permissions.sql) | Initial private/demo request storage, atomic contact save and retries |
| 4 | [people_directory_permissions.sql](../supabase/tests/people_directory_permissions.sql) | Profile discovery/ownership and real guide IDs |
| 5 | [request_delivery_permissions.sql](../supabase/tests/request_delivery_permissions.sql) | Participant-only chat, recipient-only invitation decisions, shared state and calendar conflicts |
| 6 | [check_in_time_proposals_permissions.sql](../supabase/tests/check_in_time_proposals_permissions.sql) | Recipient proposals, sender-only decisions, shared accepted times, rejection preservation and stale/conflict protection |

**Do not use `check_ins_permissions.sql` as the current full check-in test.** It
belongs to the earlier personal-plan schema and assumes direct INSERT/UPDATE
permissions that the delivery migration intentionally replaced with RPCs. Scripts
5 and 6 test the current invitation/proposal model. Scripts 1–4 alone do not
prove chat or proposal permissions.

### Execute each whole file

1. Open the linked file in the repository and copy **all of it**, from `begin;`
   through the final `rollback;`, into a new query in Supabase **SQL Editor**.
2. At the top, replace the quoted values for **both** account settings with your
   test UUIDs:

   ```sql
   select set_config('test.account_a', 'YOUR_ACCOUNT_A_UUID', true);
   select set_config('test.account_b', 'YOUR_ACCOUNT_B_UUID', true);
   ```

   Replace values even if the file already contains UUIDs instead of placeholder
   text: those may belong to an earlier tester. Use different accounts. Leave
   `test.account_c` generation and all other assertions/identity switching intact.
   You can edit the pasted query without changing the shared repository files.
3. Keep the script's final **ROLLBACK**. Some tests temporarily remove fixture
   contacts or calendar rows and change profile fields; rollback restores them.
   Run SQL tests serially, with the dedicated test accounts idle in the app so
   their temporary row locks don't interfere with your manual test session.
4. Run the **whole query together**, not selected fragments. Let the script set
   `authenticated`/`anon` roles and account identities internally. Reading tables
   as the default dashboard admin can bypass RLS and is not a permissions test.
5. Expected: a **PASS result row** and no SQL errors. The script deliberately
   catches expected permission denials. An uncaught error, generic successful
   query, or zero rows by itself is not a PASS.
6. Record the script/result, then move to the next file. If an error leaves the
   transaction aborted, run `rollback;` before retrying. Preserve the original
   assertions; don't remove a failing check to obtain PASS.

Rollback affects SQL fixtures only. It does not erase the questions/chats/meetings
created through the app earlier. These scripts do not send email or create Auth
accounts. Their temporary authenticated identities refer to the A/B accounts you
already created; no test-account passwords belong in the SQL files.

## 5. Inspect records when debugging

In the dashboard Table Editor, inspect only your test accounts' records. Useful
places to look are below; normal admin visibility is for diagnosis, not RLS proof.

| Table | Find your test record by |
| --- | --- |
| `Profiles` | `id` = account UUID; inspect name/program, listing, role/expertise/bio |
| `questions` / `answers` | Your distinctive test title/body and the question/author ID |
| `saved_answers` | Saving account's `user_id` and the real `answer_id` |
| `circle_contacts` | Sender/account `user_id` and graduate `guide_id` |
| `guidance_requests` | Sender `user_id`, graduate/`recipient_id`, message and delivery/status fields |
| `guidance_messages` | `request_id`, `sender_id`, body and timestamp |
| `check_ins` | Owner `user_id`, `recipient_id`, topic, UTC start, status and revision |
| `check_in_time_proposals` | `check_in_id`, proposer, proposed start/duration, base revision and status |
| `check_in_bookings` | Meeting and participant IDs; reservations are maintained by the server |

Use the app to change state. Editing statuses or booking rows by hand bypasses
the workflow and doesn't demonstrate that acceptance/rescheduling works.

## 6. Troubleshoot and report the result

| Symptom | Check / next action |
| --- | --- |
| Missing environment configuration | Verify both `.env.local` values point at the shared project and restart Expo. |
| A and B keep becoming the same account | Use different browser profiles/private windows/devices, not two ordinary tabs sharing storage. |
| No Profile row / invalid UUID in SQL | Open Profile as each account; copy UUIDs from Authentication → Users, not an email/name/mock guide ID. Replace both literals in the pasted test. |
| A real graduate doesn't appear | Confirm Graduate affiliation, role and Appear in People were saved; refresh People in the other account. |
| No incoming chat/invitation | Confirm you selected a real user, sent a new request/plan, and are signed into the intended recipient account. Mock guides and older private records aren't delivered. |
| State hasn't updated yet | Keep Circle/chat focused for five seconds or use its Refresh button; check the connection. |
| Missing table/function/column | Confirm current app code and the correct project. Ask the backend coordinator to inspect schema/migration status; don't rerun the creation scripts yourself. |
| SQL says the current transaction is aborted | Run `rollback;`, then retry the entire corrected script. Keep the original SQLSTATE/message for the report. |
| SQL assertion or unexpected denial fails | Stop that check and share the exact file/error. A UI success or `npm test` pass does not resolve a server-permission failure. |

When finished, remove your test questions/saves/contacts through the app, hide test
requests, and cancel your test invitations. Shared chat/invitation history may
remain by design; don't delete shared tables or teammate data to clean up.

Copy this template into your team test report:

```text
Tester / date:
Branch or commit:
Platform (browser/phone and OS):
Shared Supabase project checked (project name only):
Test accounts A/B (labels only; no passwords):
App flows exercised and observed results:
SQL files run and PASS/error for each:
Any steps not tested:
Failure steps / expected vs actual / SQLSTATE:
Screenshots (with secrets and unrelated personal data removed):
```

For a local code check, run `npm run typecheck` and `npm test`. The latest
implementation passed 77 mocked tests, but those don't connect to the live
Supabase project. Keep local test results, app checks and SQL permissions results
separate. See the [verification record](backend-status.md) and
[detailed permissions notes](database-permissions.md) for current evidence.
