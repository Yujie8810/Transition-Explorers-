# November 3 checkpoint rehearsal

**Current status (November 10):** Supabase integration now includes auth, profiles, questions, answers, and saves of real answers. Seeded demo saves and Circle remain local. Live RLS and cross-device checks are pending; follow [the permissions checklist](database-permissions.md). The rehearsal notes below describe the older checkpoint build; use the current status for new demos.

Team 4 · Transition Explorers · Career Commons

## Current status — November 10

Supabase now provides email/password authentication, profiles, shared public/anonymous questions, question ownership/editing/deletion, real answers with author names, and per-account real saved answers. Fictional questions/answers remain available; demo saves stay local. Circle contacts, guidance requests, and check-ins still use local storage, and requests do not deliver messages.

Developer-reported mobile-app checks passed for signup/login/logout, profile edits and subsequent login, two-account question visibility and personal lists, question edit/delete, real answer posting and author display, Explore answer counts, and Saved/Remove/Undo. Screenshots show matching database records. Profile RLS was exercised with an authenticated role: own-row update count 1, other-row count 0. These reports do not specify a completed rehearsal on the physical presentation phone.

Pending: deployed anonymous-feed masking; direct cross-account question/answer mutation and private-save RLS checks; cross-device persistence; email confirmation/delivery and revoked sessions; and the full phone/network/accessibility checklist. Client-side masking and mocked tests do not establish deployed server privacy. Public profile reads are intentional.

Teammates must run `npm ci`, configure `.env.local` from `.env.example`, and restart Expo. The shared database is already initialized; do not rerun its CREATE TABLE scripts. Fresh-project setup and storage details are in the README. Old local real-answer saves are preserved on disk but must be saved again to create remote records.

The rehearsal material below records the November 3 checkpoint build. Its local-only limitations and original checkboxes are historical, not a description of the current backend. Use this section and the README for current status.

Use `DP4-Checkpoint.pptx` for the 2–3 slide overview. The timeline below is proposed; confirm it with the team before presenting. Update slide status if additional work lands before class.

## Five-minute run of show

| Time | Presenter action |
| --- | --- |
| 0:00–0:40 | Slide 1: identify team, users, mobile platform, and technology choices. |
| 0:40–1:25 | Slide 2: explain simple/moderate/complex tasks and current implementation. Mention fictional data and local-only simulation. |
| 1:25–1:55 | Slide 3: describe remaining work/timeline and point to GitHub. |
| 1:55–4:30 | Switch to the live phone app and complete the main demo below. |
| 4:30–5:00 | Briefly show Profile or Your Circle if time permits; leave room for questions. |

## Main live task: find and keep advice

1. Open Explore, select **First job**, and search **first week**.
2. Open **First week nerves?** and read the answers.
3. Save Anika’s individual answer. Point out **Saved ✓** and its confirmation.
4. Use **View saved** or the Saved tab. Show the same author and answer.
5. Open the saved tip to revisit the original question.
6. Optional: show Remove/Undo in Saved. Clear the search if returning to Explore.

Before rehearsing, remove that saved answer if necessary so the live action begins unsaved. Do not clear application data on a teammate’s phone without checking with them.

## Other flows to rehearse

- Posted questions: Profile → **Your support** → **View your posted questions** → Edit question → save changes → reopen the question. Test **Cancel editing**, **Keep editing**, and **Discard edits**. Then try the red **Delete question** button: cancel with **Keep question**, then confirm deletion and verify it remains deleted after restarting. Use a throwaway demo post; seeded community questions cannot be modified.
- Profile: view fictional identity → Edit profile → change name/program/affiliation → Save → close/reopen → verify persistence. Also test blank validation and Cancel changes.
- People: find a graduate → profile → Ask for Guidance → type a request → Review request → Edit request → confirm/save → Your Circle. It must not appear in Your Circle before confirmation.
- Circle: add a graduate → schedule a future check-in → review/edit → confirm → reschedule → cancel. Verify overlapping appointments and past dates are rejected.
- Ask: write a question → select topic/visibility → review → edit → publish → open the new question. Show that new questions start with no answers; no real community receives them.

## Physical-phone checklist (team must complete)

- [ ] Run the current branch on the actual presentation phone, with its supported Expo Go version or installed native build.
- [ ] Test the full advice flow, not just the initial screen.
- [ ] Check back navigation, scrolling, and keyboard behavior. Switch all four bottom tabs and verify each lime highlight centers its icon and label without clipping, including on a phone with a home indicator.
- [ ] Save multiple answers; restart and confirm all remain saved.
- [ ] Remove/Undo and reopen saved advice; names/initials match their authors.
- [ ] Edit Profile and confirm persistence after a full restart.
- [ ] Under Profile’s **Your support**, open posted questions; edit title/details/topic/visibility and check the updated question in Explore after restarting.
- [ ] Check blank/short-title validation, cancel/discard behavior, and the empty-list link to Ask.
- [ ] Confirm both delete buttons are red with readable white text, cancellation keeps the question, and confirmed deletion persists. If deleting an original with follow-ups, verify those remain as independent posts.
- [ ] Review/edit a guidance request; confirm it appears once in Your Circle.
- [ ] Confirm classroom connection or arrange a tested hotspot/native build.
- [ ] Open the slides in PowerPoint and rehearse within five minutes.

Browser tests and bundle exports are useful checks, but do not replace this phone checklist. Keep screenshots as a fallback reference; the assignment requires a live demo.

## Proposed remaining timeline

| Dates | Work |
| --- | --- |
| Oct 29–Nov 2 | Complete integration, phone testing, visual consistency, and checkpoint rehearsal. |
| Nov 3 | Progress check: overview + live complete advice task. |
| Nov 4–8 | Aproteem: login/signup/session/logout; coordinate profile and account-specific storage with Aalvee. Refine remaining task flows and progress tracking. |
| Nov 9–12 | All owners: internal usability review, DP3 fixes, accessibility, and testing of all three tasks on the target phone. |
| Nov 13–15 | Assigned owners: Source/ReadMe/Team PDFs, cumulative PPTX, narrated/subtitled video under two minutes, packaging, and individual peer evaluations. Final deadline Nov 15, 11:59 PM CT. |

## November 3 status and limitations (historical)

The prototype has seven fictional graduates, thirteen seeded questions, and thirty seeded answers. Local edits/additions persist through AsyncStorage. Profile includes a posted-question list with editing and confirmed deletion for this device’s own public/anonymous posts; seeded questions are protected. Guidance requests simulate sending by storing locally, check-ins are personal plans, and no live messaging or backend is connected. Profile uses fictional Alex Morgan and is not a verified account. Authentication remains Aproteem’s work; all storage is currently device-wide rather than per account. History lists check-ins; the richer goals/reflections/progress experience from Figma still needs refinement.

Repository: https://github.com/Yujie8810/Transition-Explorers-

## Automated checks completed October 29

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

## November 9 Supabase integration update (historical)

Auth now uses Supabase email/password signup/login, session restoration/refresh, and logout. Signup handles projects requiring email confirmation without granting access early. Profile reads/edits use the existing `public."Profiles"` table; a missing row is created after authentication, without overwriting an existing row. Student/Graduate affiliation is self-reported Auth metadata. Configure `.env.local` using `.env.example`, install dependencies, and restart Expo.

Questions, saved tips, Circle contacts, guidance requests, and check-ins still use local storage, separated by Supabase user ID. Existing demo-account/device data is preserved without automatic migration. Earlier rehearsal limitations above describe the checkpoint build, not the new auth implementation. Live Supabase verification, two-account RLS checks, email confirmation, and phone testing remain required; see README's Supabase setup.

Validation for this integration: TypeScript and all 17 automated tests passed; Android, iOS, and web Metro exports passed. Tests mock Supabase and do not establish live project connectivity or deployed RLS behavior.

## November 10 advice backend update

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
has not been executed against the team's Supabase project. Live anonymous output,
ownership/private saves, cross-device persistence, email delivery, and physical-phone
checks remain pending. See [the step-by-step checklist](database-permissions.md).
Android, iOS, and web Metro exports also passed for this handoff. These exports do not establish an installed native build or physical-phone readiness.

Next backend work after permission verification: Circle contacts, guidance requests,
and check-ins, which still use account-specific AsyncStorage.
