# Circle contacts: current integration

Circle contacts use Supabase and are developer-reported working, including
add/remove, account isolation and restoration on another device. The original
contact permissions script returned PASS in a developer-provided screenshot.
See the [current verification record](backend-status.md) for later features.

## Data and permissions

`circle_contacts` stores private `(user_id, guide_id)` membership. Signed-in users
can read/add/remove their own contacts; RLS prevents forged ownership. `guide_id`
remains text so the same table supports both the seven fictional IDs and real
Profile UUIDs after the directory migration. Self-contact additions are blocked;
legacy self-contacts are hidden without deleting historical data.

The database prevents removing a contact with active pending/accepted/personal
check-ins. Declined/cancelled plans do not block removal. Past history remains.

The shared team project already has the schema. For a **fresh project only**, run
the [full README migration order](../README.md#supabase-authentication-setup),
including [circle_contacts.sql](../supabase/migrations/circle_contacts.sql) and the
later directory/delivery/proposal migrations. Do not rerun table creation on the
team project.

## App code

[networkApi.ts](../src/features/network/networkApi.ts) exposes
`fetchCircleContacts`, `addCircleContact`, and `removeCircleContact`. Explicit
account filters bind requests to their initiating account; RLS supplies server
authorization. Adds use an upsert with duplicate prevention; removing an already
removed contact is safe to retry.

[NetworkProvider.tsx](../src/features/network/NetworkProvider.tsx) loads all Circle
sources, serializes changes/refreshes, updates visible state after persistence,
and ignores late account results. Root remounts it on account changes. Circle
refreshes on focus/foreground and every five seconds while open, with manual
Refresh available. Legacy AsyncStorage contacts remain untouched without upload.

Saving a guidance request uses one RPC to commit the request/contact together.
See [guidance requests](guidance-requests.md), [chat/invitations](request-delivery.md)
and [recipient proposals](check-in-time-proposals.md) for their current workflows.

## Regression checks

1. As A, add a real graduate or mock guide and confirm one contact appears.
2. Sign into A on another device; refresh and confirm it appears. Remove it and
   verify the first device updates. As B, verify A's private contact list is absent.
3. Confirm you cannot add yourself or create a self-request/check-in.
4. Attempt removal with an upcoming active check-in; cancel first, then remove.
5. Run [circle_contacts_permissions.sql](../supabase/tests/circle_contacts_permissions.sql)
   with two account UUIDs if rechecking the original private-contact rules. Use the
   newer [delivery](../supabase/tests/request_delivery_permissions.sql) and
   [proposal](../supabase/tests/check_in_time_proposals_permissions.sql) checks for
   later participant/decision behavior. Keep each script's final rollback.

The latest full suite has 77 mocked tests, with TypeScript and all platform
exports passing. Those implementation checks do not replace live SQL permissions.
