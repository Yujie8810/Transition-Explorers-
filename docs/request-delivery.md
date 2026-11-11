# Guidance chat and scheduled check-in invitations

The later [recipient rescheduling migration](check-in-time-proposals.md) adds
new-time proposals that the original sender can accept or reject.

The shared project is developer-reported deployed and working. Screenshots show
private guidance replies and invitation declines reflected on both accounts.
Do not rerun `request_delivery.sql` or older creation scripts there. For a fresh
project follow the [README migration order](../README.md#supabase-authentication-setup),
which applies delivery after the directory migration and before time proposals.
See the [verification record](backend-status.md) for the evidence and outstanding QA.

## User flows

- Your own People profile offers **Edit your profile**. Self-contact, self-request,
  and self-scheduling writes are also rejected by the provider/database.
- Send a real graduate a guidance request. In **Your Circle → Your guidance
  requests → Open chat**, the original request is the first chat bubble. The
  graduate opens **Your Circle → Requests received → Open chat** and replies.
  Both people can send follow-up messages. Messages display separate incoming
  and outgoing bubbles, names, and timestamps, with a persistent composer.
- Schedule a real person from a Circle contact. Review the date/time, duration,
  topic and time zone, then send the invitation. The recipient sees these details
  under **Check-in invitations received**, with **Accept invitation** and
  **Decline invitation**. The sender sees Awaiting acceptance, Accepted, or
  Declined. Accepted meetings appear in both people's upcoming/history views.
- Rescheduling by the sender resets acceptance and increments the invitation
  revision. A decision from a stale screen cannot approve the new time.
  Cancellation by the sender remains visible to the recipient as Cancelled.
- The separate, untimed **Check-in** guidance-request option still supports a
  willingness-to-meet decision; accepting it does not reserve a time. The sender
  can then propose a scheduled invitation, which needs its own acceptance.

Circle and chats refresh on focus, on returning from the background, every five
seconds while focused, and through Refresh. This is polling, not Supabase
Realtime or a push notification. A closed/background app does not alert the user.
Draft text is kept on send/refresh failure while the chat screen remains mounted;
there is no persistent offline message outbox.

## Privacy and existing data

Only a request's two participants can read its chat. Only the recipient may
respond to an invitation. Client filters are supplemented by RLS and guarded
RPCs that validate the current account before accessing privileged data.

Old private real-user requests and check-ins are **not** retroactively delivered.
Send a new request or explicitly edit a legacy plan to deliver it. Fictional guide
requests/check-ins remain personal demo records and do not have a working inbox.
Old self-contacts are hidden by the provider without deleting historical data;
new self-contact writes are blocked by a NOT VALID constraint on existing rows.

Hiding a delivered request hides the sender's copy; it does not erase the
recipient's conversation. A new guidance reply restores it in the sender's list.
Delivered invitations are cancelled by a shared state change, not hard-deleted.
Owner deletion permissions remain for private/demo plans. Profile/account deletion
still cascades owned content; this is not a message archival system.

Pending invitations reserve the sender's time. Accepting also reserves the
recipient's time in a private booking table with a GiST exclusion constraint.
Conflicts across incoming and outgoing meetings fail atomically; declining or
cancelling releases that reservation. Database row locks serialize decisions,
rescheduling and cancellation; identical decision retries are safe. Message retry
tokens prevent duplicate sends after a lost response within the mounted provider.
Reopening the app loses an uncertain draft's token: check the thread before
resending manually.

## Permissions and regression verification

The app flows are developer-reported working. A separate PASS result for this
delivery permissions script has not been recorded; run it if outstanding.

Replace A/B placeholders in `supabase/tests/request_delivery_permissions.sql` with
two existing Auth/Profile account UUIDs, then run the **whole file**. Its fixtures
and temporary calendar cleanup roll back. It covers self guards, participant
privacy, forged/third-party writes, two-way messages, token retries, recipient-only
acceptance, shared decisions/cancellation, stale revisions, calendar conflicts,
and signed-out chat denial. This script supersedes the original check-in
permissions script's direct-INSERT/UPDATE assumptions: mutations now use RPCs.

For a regression or final demonstration, use two accounts/devices:

1. A sends B guidance. B opens Circle and replies; A sees the reply within five
   seconds while the chat is focused. Send another message from A and verify B.
2. Disable the network while composing; confirm the draft survives a failed send.
   Reconnect and retry once, then confirm one message on both devices.
3. A proposes a future check-in. B sees the exact date/time and duration; test both
   accepting and declining separate invitations, and A sees each decision.
4. Reschedule an accepted invitation. Confirm pending on both sides, and verify
   B must accept the updated time. Cancel and verify cancellation on B.
5. Give B a conflicting personal/accepted meeting. Confirm accepting an overlapping
   invitation fails; adjacent times should be allowed. Try simultaneous accepts
   for overlapping invitations on two devices: at most one should commit.
6. Verify A cannot add/request/schedule themselves, and mock guides still work.
   Check keyboard, scrolling, bubble alignment and composer on the actual phone.

Latest implementation checks: all 77 mocked tests and TypeScript pass; Android,
iOS, and web Expo exports pass. Live chat and shared decisions are working by the
developer report. Separate SQL PASS results, live concurrency edge cases and the
full presentation-phone rehearsal still need recorded results where outstanding.
