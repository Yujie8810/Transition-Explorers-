# Recipient-proposed check-in times

The developer reports the recipient proposal and original-sender decision flow
works on the shared project. Backend integration for this feature is complete;
do not rerun its migration there. For a fresh project, run the full
[README migration order](../README.md#supabase-authentication-setup), ending with
`check_in_time_proposals.sql` after `request_delivery.sql`.

A separate PASS result for the proposal permissions script has not been recorded.
Successful app checks and SQL permissions results are tracked separately in the
[verification record](backend-status.md).

The recipient now sees **Reschedule and propose a new time** immediately below
Decline on an incoming invitation. It also remains available on accepted/declined
invitations until their original meeting ends. The recipient does not need to add
the sender as a contact. They enter a future date, local time and 15/30-minute
duration, review the change, then send it.

The original sender sees both the original time and the proposed new time, with
**Accept new time** and **Reject new time** in Circle. Accepting updates the same
meeting and confirms the new time for both people. Rejecting leaves the original
meeting's time and status unchanged. Existing bookings remain in place while the
proposal waits. Proposed times are not reserved until acceptance; conflicts for
either participant cause the entire acceptance transaction to roll back.

Only one proposal can be pending for a meeting. While waiting, the recipient sees
its pending status instead of accepting the original time accidentally. The
sender may still reschedule/cancel independently, which supersedes pending
proposals. Revision checks reject stale approvals. Identical proposal/decision
retries are safe within the mounted provider. Sender decisions return both the
proposal and current canonical meeting, including on an idempotent retry.

Both users see proposal/decision updates through the existing five-second focused
Circle refresh. Original sender edits still use the existing reschedule flow,
which asks the recipient to accept the sender's changed invitation.

Replace A/B placeholders in `supabase/tests/check_in_time_proposals_permissions.sql`
with two existing Profile UUIDs and run the **whole file**. It rolls back all
fixtures and temporary calendar changes, and checks participant privacy, roles,
new-time acceptance/rejection, retries, shared updates, stale proposals, calendar
conflicts and signed-out denial.

Regression/final-demo checks (the working flow is developer-reported):

1. A schedules B; B chooses Reschedule below Decline and proposes a future time.
2. A sees both times and rejects. Confirm original time/status stay unchanged on B.
3. B proposes again; A accepts. Confirm the new time, duration, and Accepted state
   appear for both accounts and survive reopening the app.
4. Test an already accepted invitation; keep its original booking until the new
   proposal is accepted. Test conflicting new times and confirm no partial change.
5. A edits or cancels while a proposal waits; verify the old proposal cannot move
   the meeting. Test failed sends/retries and confirm no duplicate pending proposal.

Local validation: TypeScript, all 77 mocked tests, and Android/iOS/web Expo exports pass. Tests cover button order,
sender-only controls, both accounts, rejection preservation, role validation,
failed/lost responses, stale proposals, conflicts, and logout isolation. Record any outstanding SQL permission, live
concurrency or presentation-phone results; these are QA tasks, not missing wiring.
