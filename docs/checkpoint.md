# Current handoff and checkpoint rehearsal

Team 4 · Transition Explorers · Career Commons

## Current status — November 10, 2026

**Backend wiring is complete for the implemented app tasks.** The developer
reports working accounts/profiles, advice/questions/answers/saves, real People
listings, contacts, private guidance chat, shared scheduled invitations, and
recipient-proposed times with original-sender accept/reject decisions.
Screenshots show a real listing, a guidance reply, an invitation and its declined
state on both accounts. Recipient time proposals are reported working.

The latest code passed **77 mocked tests**, TypeScript and Android/iOS/web Expo
exports. Earlier advice/contact/request SQL checks and the baseline check-in
permissions test passed; separate PASS results for the newer directory, delivery
and proposal scripts have not been recorded. See the [verification record](backend-status.md)
and [permissions checklist](database-permissions.md). Current setup and the ordered
fresh-project migrations are in the [README](../README.md). Do not rerun creation
scripts on the working shared team project.

Mock graduates/questions/answers remain alongside live data by design. Demo saves
stay device-local; mock-guide requests/plans are personal records without delivery.
They do not replace the backend for offline writes. Legacy local records are not
automatically uploaded. Circle/chat polls every five seconds while open; there
are no push notifications or calendar integration.

## Suggested five-minute demonstration

| Time | Presenter action |
| --- | --- |
| 0:00–0:40 | Introduce users, problem, team and mobile platform. |
| 0:40–1:20 | Explain the three task flows and what uses real Supabase data. Identify the retained fictional examples. |
| 1:20–2:20 | Explore → filter/search → question → save one answer → Saved → reopen. Use a real answer to demonstrate remote persistence. |
| 2:20–3:30 | Two signed-in accounts: request guidance from a real listed graduate, open the recipient inbox/chat, reply, and show the sender's reply. |
| 3:30–4:40 | Send a scheduled invitation. Show Accept/Decline and recipient Reschedule; propose a new time and have the original sender accept or reject. |
| 4:40–5:00 | Show the shared final state and close within the time limit. |

This is a suggested rehearsal, not a record that a full run has passed. Prepare
two accounts with existing Profile rows, a real listed graduate, and a future
available slot. Practice the five-second polling delay and use Refresh if needed.
For the fictional-advice demo, **First job → first week → First week nerves?**
remains available, but saving its seeded answer demonstrates local demo storage.

## Presentation-phone and final QA checklist

Reported app flows work; the team still needs to record the full final rehearsal
on the actual presentation phone/network. Individual screenshots do not complete
this checklist.

- [ ] Run the current branch/build on the actual presentation phone.
- [ ] Rehearse the full task sequence and stay within the presentation time limit.
- [ ] Check back navigation, scrolling, keyboard/chat composer, safe areas and all
  four tab highlights; check readable labels, touch targets and accessibility.
- [ ] Confirm real question/profile/save persistence after restart and across devices;
  check Remove/Undo and owned-question editing/deletion/follow-up behavior.
- [ ] Confirm both accounts can exchange chat messages, and failed sends keep the
  draft while mounted without duplicate delivery on retry.
- [ ] Confirm scheduled Accept/Decline, sender edit/cancel and recipient proposals
  appear correctly on both accounts. Rejecting a proposal must preserve the
  original meeting; accepting must update the time/duration for both people.
- [ ] Record any outstanding newer SQL permissions results, cross-account answer
  mutation/signed-out checks, confirmation/email delivery, revoked sessions,
  offline retries and simultaneous-calendar conflict checks.
- [ ] Verify classroom network or a tested hotspot/build and prepare screenshots
  as a fallback reference for the live demo.
- [ ] Prepare the final presentation, Source/ReadMe/Team PDFs, and narrated/subtitled
  video; follow the team's assignment requirements and peer-evaluation process.

The earlier checkpoint PPTX is not present in this checkout. Keep final
presentation artifacts and their status separate from backend implementation.
No claim is made here that an installable APK or final presentation package exists.

## Proposed team timeline

The earlier team plan allocated November 9–12 to usability/accessibility and
end-to-end testing, and November 13–15 to final presentation/submission packaging.
It recorded a November 15, 11:59 PM CT deadline; confirm assignment requirements
with the team. Backend wiring is no longer a remaining feature task.

## Historical notes — superseded builds

The following entries preserve earlier checkpoint/integration history. Local-only
limitations, earlier test counts, and deployment-pending statements below describe
those stages, not the current app. Use the current status above for handoff/demo.

### November 3 status and limitations (historical)

The prototype has seven fictional graduates, thirteen seeded questions, and thirty seeded answers. Local edits/additions persist through AsyncStorage. Profile includes a posted-question list with editing and confirmed deletion for this device’s own public/anonymous posts; seeded questions are protected. Guidance requests simulate sending by storing locally, check-ins are personal plans, and no live messaging or backend is connected. Profile uses fictional Alex Morgan and is not a verified account. Authentication remains Aproteem’s work; all storage is currently device-wide rather than per account. History lists check-ins; the richer goals/reflections/progress experience from Figma still needs refinement.

Repository: https://github.com/Yujie8810/Transition-Explorers-

### Automated checks completed October 29

- TypeScript passed; Metro exports passed for Android, iOS, and web.
- Mobile-sized Chromium browser: advice search/filter, individual tip save, reload persistence, remove/undo, and reopening the question passed.
- Profile: blank-field validation, editing name/program/affiliation, save/reload persistence, cancel, and Saved navigation passed.
- Posted questions: real Ask publication, empty state, edit validation, title/details/topic/visibility changes, preserved ID/date, reload persistence, cancel/discard, Explore synchronization, seeded-post protection, and delete cancellation/confirmation/persistence passed in Chromium.
- Navigation: centered lime active-tab highlight visually checked at a 390 × 844 browser viewport. Delete buttons use red/white styling; TypeScript checks passed after that styling change.
- Requests: required message, review with no early storage, return-to-edit with draft preserved, one confirmed stored request, and Circle display passed.
- Network integration: the confirmed request adds a contact; scheduling/review/confirmation creates a check-in shown in Circle.
- No browser runtime errors were observed during these flows.
- PPTX structure checked: three slides with speaker notes and an actual web-preview screenshot.

Physical-device checks above remain pending; no claim is made that an APK has been built or that Expo Go was exercised on a phone.

### November 9 Supabase integration update (historical)

Auth now uses Supabase email/password signup/login, session restoration/refresh, and logout. Signup handles projects requiring email confirmation without granting access early. Profile reads/edits use the existing `public."Profiles"` table; a missing row is created after authentication, without overwriting an existing row. Student/Graduate affiliation is self-reported Auth metadata. Configure `.env.local` using `.env.example`, install dependencies, and restart Expo.

Questions, saved tips, Circle contacts, guidance requests, and check-ins still use local storage, separated by Supabase user ID. Existing demo-account/device data is preserved without automatic migration. Earlier rehearsal limitations above describe the checkpoint build, not the new auth implementation. Live Supabase verification, two-account RLS checks, email confirmation, and phone testing remain required; see README's Supabase setup.

Validation for this integration: TypeScript and all 17 automated tests passed; Android, iOS, and web Metro exports passed. Tests mock Supabase and do not establish live project connectivity or deployed RLS behavior.

### November 10 advice backend update

Questions now load through `get_question_feed`, and create/edit/delete operations
persist in Supabase with ownership policies. The RPC masks anonymous author IDs;
the app assigns null anonymous names and resolves public names from Profiles.
Profile lists only the current account's questions. Real answers load with profile
attribution, and signed-in users can post answers. Real-answer saves persist in
`saved_answers`; saves of fictional seeded answers remain local. Fictional examples
still appear alongside real content. No automatic upload of legacy local data or
realtime synchronization is implemented.

Updated stale Ask mocks to account for the advice API import. Local isolation tests
now target Circle; question tests check shared remote content, owner-only Profile
listing/actions, edits, deletion, and restoration from a fresh provider. Existing
save tests cover remote persistence, account isolation, errors/retry, remove/undo,
and local demo data. These mocks do not verify server permissions.

Validation on November 10: `npm test` passed all 33 tests; `npm run typecheck`
passed. The new [rollback-only permissions SQL](../supabase/tests/advice_permissions.sql)
returned PASS in the developer-provided Supabase SQL Editor screenshot: anonymous
feed masking, question ownership, and private saves passed, with fixtures rolled back.
B’s actual app/Network anonymous response also passed, supported by the developer’s
screenshot. Cross-device persistence is developer-reported passed, with matching
profile screenshots; save synchronization relies on the report rather than matching
Saved counts in those screenshots. Email delivery and the full physical-phone
checklist remain pending. See [the step-by-step checklist](database-permissions.md).
Android, iOS, and web Metro exports also passed for this handoff. These exports do not establish an installed native build or physical-phone readiness.

Next backend work after permission verification: Circle contacts, guidance requests,
and check-ins, which still use account-specific AsyncStorage.


### Circle contacts implementation — November 10

Added a commented `circle_contacts` table with private SELECT/INSERT/DELETE RLS,
an API for loading/adding/removing contacts, and a provider that combines remote
contact membership with local requests/check-ins. Contact IDs still reference the
seven fictional People guides. Legacy contact IDs stay on disk without automatic
upload. Guidance-request confirmation adds a remote contact before saving the
local request; a local failure leaves that contact added and supports request retry.
Check-in guards still cover only this device's plans.

`npm test` passed all 38 tests and TypeScript passed for this change. A developer-provided
November 10 Supabase SQL Editor screenshot shows the Circle permissions script
returned PASS for private contact access, own-contact operations, forged-owner insert
denial, cross-account delete denial, and signed-out read denial; fixtures rolled back.
The developer subsequently reports app add/remove, same-account cross-device
restoration/removal after reload, and other-account isolation passed. Screenshots
show the saved-contact button and contact counts of 1 and 0; they do not independently
establish the whole sequence. Follow
[the commented walkthrough](circle-contacts.md); do not rerun table creation on
the initialized team project.
Guidance requests and check-ins are the next backend steps after contacts pass.


### Guidance requests implementation — November 10

Added commented `guidance_requests.sql` with owner-only SELECT/INSERT/DELETE RLS
and a SECURITY INVOKER RPC that saves a request and its contact atomically.
Requests have generated IDs/dates and validated guide/type/message fields. An
owner-scoped retry token prevents duplicate creation when an unchanged failed
draft is retried within the mounted provider. Dismissal preserves the contact.
The earlier Circle two-store save behavior above is superseded by this RPC.

The provider now loads contacts/requests remotely and check-ins locally, preserves
legacy local requests without auto-upload/display, and ignores late account
results. Request review supports a 2000-character maximum. Tests cover fresh-device
request restoration/dismissal, account separation, failed writes, uncertain-response
retry, validation, preserved legacy data, and logout during a request.

Validation: all 43 mocked tests and TypeScript passed. A November 10 developer-
provided SQL Editor screenshot confirms the guidance permissions script returned
PASS for private requests, contact creation, retry behavior, and signed-out denial;
fixtures rolled back. App checks are developer-reported passed. Screenshots show
request review and the saved request/contact in Circle; cross-device dismissal and
account isolation rely on the report rather than independent screenshot evidence. Follow
[the request walkthrough](guidance-requests.md) and run its rollback-only permissions
script with A/B UUIDs. Check-ins remain the next backend feature.


### Check-ins implementation — November 10

Added commented `check_ins.sql`, an API for loading/saving/cancelling, and remote
provider integration for scheduling, rescheduling, cancellation, and date-derived
history. The database migration defines owner-only RLS, an invoker save RPC,
owner-scoped retry tokens, and a GiST exclusion constraint for per-account overlaps.
Validation computes end times, checks finite future starts and current contact
membership, and prevents reassignment. Narrow definer triggers coordinate contact
removal and scheduling using the contact row, reject removal with upcoming/ongoing
plans, and preserve past history. Earlier device-only removal guards are superseded.

All Circle data now loads remotely. Legacy local keys remain untouched, without
automatic upload or display as remote records. Recreate older plans to save them
remotely. Only fictional demo answer saves still actively use local feature storage.

Validation: all 48 mocked tests, TypeScript, and whitespace checks passed. The new
migration/permissions SQL has not been executed against the team project. Live
RLS/constraints/triggers, concurrent saves/removal, cross-device flows, and physical-
phone checks remain pending. Follow [the commented check-in walkthrough](check-ins.md).
Earlier Circle/guidance SQL tests were made compatible with the new contact guard
by temporarily clearing only their test-guide plans, with full rollback restoration.
