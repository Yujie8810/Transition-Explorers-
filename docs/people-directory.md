# Real People profiles

New requests and scheduled plans for real users use the working
[chat/invitation integration](request-delivery.md), with
[recipient time proposals](check-in-time-proposals.md).

People can now show real Supabase users alongside the seven fictional graduates.
Listing is explicit and self-reported; it is not verified graduate status.

## Deployment and verification

The shared team project's directory is developer-reported deployed and working;
a supplied screenshot shows a real user's name, role, expertise and bio. The later
[chat/invitation](request-delivery.md) and [proposal](check-in-time-proposals.md)
features are also developer-reported working. Do not rerun the directory migration
on that project. For fresh projects use the [README migration order](../README.md#supabase-authentication-setup).

`people_directory.sql` adds `Profiles.listed_in_people` (default false) and
`expertise`, reuses `current_role` and `bio`, and extends guide validation to real
Profile UUIDs while preserving fictional IDs. Existing owner-only profile writes
and private Circle membership stay in place.

A separate PASS result for `supabase/tests/people_directory_permissions.sql` has
not been recorded. Run the whole rollback-only script with two existing account
UUIDs if outstanding. See [backend-status.md](backend-status.md) for current
implementation and verification evidence.

## Add yourself

1. Sign in with your real account and open **Profile**.
2. Choose **Edit profile**, set your name/program and **Graduate**, then save.
3. Under **Your People profile**, choose **Edit People profile**.
4. Enter a role/job title, comma-separated expertise, and an optional bio.
5. Turn on **Appear in People**, then **Save People profile**.
6. Open People; your real listing appears alongside the mock graduates. Search
   for your name. Another signed-in account can use **Refresh people** to see it.

Turn off **Appear in People** and save to remove yourself from discovery.
Existing contacts/history still resolve your profile. Profiles were already
readable to signed-in users; this switch is a discovery preference, not a new
privacy restriction. Student accounts can edit directory fields, but the UI asks
them to self-identify as Graduate before publishing.

Community profiles refresh when People receives focus or the user taps Refresh.
There are no realtime subscriptions. Load failures preserve demo graduates and
any already-loaded profiles, show an error, and offer retry; they do not report
successful remote writes. New real listings require a working backend.

## Regression checks

- A publishes; B refreshes and finds A by name, role, and expertise.
- B views A's real bio, adds A to Circle, saves a guidance request, schedules,
  reschedules, and cancels a check-in. Reload/restart to confirm persistence.
- A hides the listing; B refreshes People and no longer sees it, while B's existing
  Circle contact/history still resolves A. Re-enable and confirm it returns once.
- Confirm all seven mock graduates still work. Disconnect the backend and confirm
  mock People entries remain visible, with a retry message for community profiles.

Real-user guidance now has private two-way chat, and new scheduled invitations
can be accepted/declined or rescheduled through a recipient proposal. Mock guides
and older private records keep their personal/demo behavior.
Deleted accounts may leave an unavailable contact in someone else's history;
contacts can still be removed after any upcoming check-ins are cancelled.

Latest implementation verification: TypeScript, all 77 mocked tests, and
Android/iOS/web Expo exports passed. Tests cover directory
mapping/validation/owner scoping, publish/hide, failed writes/loads/retry, retained
mock entries, stale responses, logout, and real UUID Circle flows. They do not
establish deployed SQL behavior or physical-phone layout.
