# Check-ins: current integration

Scheduling, shared invitations, decisions, cancellation, history and recipient
new-time proposals use Supabase. The developer reports the flows work, and
explicitly reported the baseline check-in SQL permissions script passed.
Screenshots show an invitation's time/duration, recipient controls, and the same
declined result on both accounts. Later proposal behavior is developer-reported
working. See the [verification record](backend-status.md) for evidence and QA.

## Personal plans and shared invitations

New schedules for real users are delivered invitations. The recipient can accept,
decline, or choose **Reschedule and propose a new time**. Both users see decisions.
Accepted meetings appear in both calendars/history views. Sender edits reset
acceptance; sender cancellation remains visible to the recipient.

Recipient proposals preserve the original meeting until the original sender
accepts the new time. Rejection leaves its time/status unchanged. See the
[proposal walkthrough](check-in-time-proposals.md) for the complete flow.

Mock-guide schedules remain personal plans. Older private real-user plans are not
retroactively delivered; explicitly editing one can create an invitation. Legacy
local plans remain on disk without automatic upload or display as remote records.

## Tables and server checks

- `check_ins` stores the owner/recipient, topic, 15/30-minute duration, start/end
  timestamps, state, retry token and invitation revision. History is date-derived.
- `check_in_bookings` reserves the sender's time while pending and both users'
  time after acceptance. An exclusion constraint rejects overlaps across incoming
  and outgoing meetings; adjacent slots are allowed. Decline/cancellation releases
  reservations.
- `check_in_time_proposals` stores recipient suggestions and sender decisions.
  Proposed slots are not booked until accepted. Conflicts roll back the whole
  acceptance, including its decision state.
- Guarded RPCs check account identity and actor permissions. Row locks/revisions
  prevent stale decisions from accepting changed times. The database calculates
  end times, requires future schedules/contact membership, and prevents identity
  reassignment/self-scheduling.
- A trigger blocks contact removal while an active check-in is upcoming/ongoing.
  Past, declined and cancelled plans do not block removal. Delivered cancellations
  preserve a shared Cancelled state; private/demo cancellation deletes the plan.

Circle refreshes on focus/foreground return, every five seconds while open, and
through Refresh. Times display in the viewer's local time zone; server timestamps
represent the same instant across accounts.

## Setup and app code

The shared project is developer-reported deployed and working. Do not rerun its
one-time scripts. For fresh projects follow the [README migration order](../README.md#supabase-authentication-setup).
[check_ins.sql](../supabase/migrations/check_ins.sql) is the initial personal-plan
migration; [request_delivery.sql](../supabase/migrations/request_delivery.sql)
adds shared invitations/bookings, and
[check_in_time_proposals.sql](../supabase/migrations/check_in_time_proposals.sql)
adds recipient proposals. Later migrations replace original owner-only read and
direct-mutation assumptions with participant reads and guarded RPCs.

[networkApi.ts](../src/features/network/networkApi.ts) maps database rows and calls
save/response/cancel/proposal operations. [NetworkProvider.tsx](../src/features/network/NetworkProvider.tsx)
serializes writes and refreshes, shows persisted results, reuses retry tokens for
uncertain writes, and ignores results after account changes. The latest code passed
77 mocked tests, TypeScript and Android/iOS/web exports.

## Current permissions and regression checks

Use [request_delivery_permissions.sql](../supabase/tests/request_delivery_permissions.sql)
and [check_in_time_proposals_permissions.sql](../supabase/tests/check_in_time_proposals_permissions.sql)
with two existing account UUIDs, running each **whole file** with its rollback.
Their separate live PASS results are not yet recorded. The original
[check_ins_permissions.sql](../supabase/tests/check_ins_permissions.sql) tests the
baseline schema; its direct INSERT/UPDATE assumptions are superseded after delivery.
Do not treat an earlier PASS as verification of newer recipient/proposal rules.

1. A invites B; check matching times/duration, acceptance/decline and persistence.
2. B proposes a new time; A rejects, then accepts a separate proposal. Check both
   accounts and confirm rejection preserves the original meeting.
3. Edit/cancel with another device open; stale decisions must not overwrite newer
   details. Check cancellation on the recipient account.
4. Test overlapping and adjacent slots, including simultaneous decisions on two
   devices. Confirm conflicts cannot leave a partial decision/booking.
5. Verify private/demo plans, contact-removal guards, history, time zones, and
   failed-network retries. Complete final phone/keyboard/network checks separately.
