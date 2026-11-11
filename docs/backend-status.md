# Backend integration and verification record

Last updated November 10, 2026, after the developer reported that recipient time
proposals work and confirmed completion of the implemented backend flows.

## Integration status

**Backend wiring is complete for the currently implemented app.** The shared team
project is developer-reported deployed and working. No additional backend feature
integration is required to exercise the existing tasks. Do not rerun one-time
creation migrations on that project. See the [README](../README.md) for fresh-project
migration order, current behavior, mock data, and known limits.

| Flow | Recorded live evidence |
| --- | --- |
| Accounts, profile edits, questions, answers, real saves | Developer-reported passing app checks, including account/device persistence; earlier profile/advice screenshots support parts of the report |
| Circle contacts and initial request storage | Developer-reported app/cross-device/isolation checks; earlier SQL PASS screenshots |
| Real People profiles | Developer reports working; screenshot shows the real profile's name, role, expertise and bio |
| Baseline personal check-ins | Developer reports working and explicitly reports the check-in SQL permissions test passed |
| Guidance chat | Screenshots show a real request and the recipient's reply in the sender's chat; developer reports working |
| Scheduled invitations and shared decisions | Screenshots show received date/time/duration, Accept/Decline controls, and the declined result on both accounts; developer reports the flows work |
| Recipient new-time proposals and sender accept/reject | Developer reports working after the proposal implementation; no separate screenshot sequence was supplied |

A working flow implies its required schema is available, but the assistant did
not directly inspect the live database or execute SQL on the team's project.
The developer's report is the basis for current deployment/app status. Screenshots
establish the displayed states, not every concurrency, restart or failure case.

## Local implementation checks

The latest code passed **77 mocked tests**, `npm run typecheck`, whitespace checks,
and Android/iOS/web Expo exports. Coverage includes self-action blocking, private
chat state, two-account invitation decisions, recipient proposals, rejection
preservation, failed/lost response retries, stale revisions, conflicts and logout
isolation. Mocks verify app behavior against a controllable API; they do not prove
server permissions or simultaneous live database behavior.

This documentation update does not change app code, SQL, or deployed data. The
implementation test/export results above are the latest previously completed
checks, not new live tests performed while editing documentation.

## SQL permissions evidence

| Check | Recorded result |
| --- | --- |
| Profile owner update vs another user | Passed: developer reported affected row counts 1 and 0 |
| Advice ownership, anonymous-feed masking, private saves | PASS screenshot; B's actual Network response separately confirms masked anonymous author ID |
| Original Circle contact permissions | PASS screenshot |
| Original guidance-request permissions | PASS screenshot; this covers the initial private/demo request model |
| Baseline check-in permissions | Developer explicitly reported PASS before delivery/proposals were added |
| People directory permissions | Separate PASS result not recorded |
| Request delivery/chat/shared invitation permissions | Separate PASS result not recorded |
| Recipient time-proposal permissions | Separate PASS result not recorded |

Earlier permission results do not certify every rule added by later migrations.
Use [database-permissions.md](database-permissions.md) to run any unrecorded current
scripts. A missing recorded result is a verification item, not an unfinished
backend integration. Do not mark a script PASS based only on successful screens.

## Final QA and presentation handoff

Remaining work is verification and presentation preparation. Record any untested
cross-account answer mutations/signed-out access, latest SQL permissions, live
concurrency, confirmation/email delivery, revoked sessions, and offline retry
behavior. Complete the actual presentation-phone navigation, keyboard,
accessibility, network and rehearsal checklist in [checkpoint.md](checkpoint.md).

Keep mock graduates/questions/answers for demonstrations. They coexist with live
content; they do not provide an offline replacement for remote writes or delivery.
Demo-answer saves stay device-local. Circle/chat uses focused five-second polling,
not push notifications or Supabase Realtime. Password recovery, calendar sync and
richer goals/reflections are outside the implemented feature scope.
