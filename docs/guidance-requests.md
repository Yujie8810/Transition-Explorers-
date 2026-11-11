# Guidance requests: current integration

Guidance requests, recipient delivery and private two-way chat are implemented
and developer-reported working. Screenshots show the original request and a real
recipient reply in the sender's conversation. Earlier private/demo request SQL
checks returned PASS; separate results for newer delivery permissions have not
been recorded. See the [verification record](backend-status.md).

## Data and delivery

`guidance_requests` stores the sender, guide/recipient, request kind, message,
retry token, delivery time, response status and sender visibility. Messages use
`guidance_messages`. `save_guidance_request` commits the request and contact
atomically; failures roll both back. Initial request text is 1–2000 trimmed
characters. Chat messages are 1–5000 characters.

New requests to real profiles are delivered. Participants can read their request
and chat; only the recipient may decide an untimed Check-in request. Advice replies
use chat, where either participant can send follow-up messages. Self-requests are
blocked in the UI, provider and database.

Fictional-guide requests remain personal demo records without delivery. Older
private real-user requests are not retroactively delivered; send a new request to
start a conversation. Hiding a delivered request preserves the recipient's copy;
a new guidance reply restores the sender's listing. The contact remains saved.

The untimed **Check-in** option asks about willingness to meet. Acceptance does
not reserve a time. The sender then proposes a scheduled invitation with its own
decision; see [check-ins](check-ins.md).

## Setup and app code

The shared team schema is deployed and developer-reported working. Fresh projects
must follow the [complete migration order](../README.md#supabase-authentication-setup).
The original [guidance_requests.sql](../supabase/migrations/guidance_requests.sql)
adds storage/atomic saves; [request_delivery.sql](../supabase/migrations/request_delivery.sql)
adds participant reads, chat and guarded decisions. Do not rerun either on the
working team project.

[networkApi.ts](../src/features/network/networkApi.ts) maps outgoing/incoming
requests and messages and calls the save/hide/chat/response RPCs.
[NetworkProvider.tsx](../src/features/network/NetworkProvider.tsx) queues writes
and refreshes, waits for successful persistence, and ignores late account results.
Unchanged uncertain sends reuse in-memory tokens. Reloading loses those tokens;
inspect the thread/Circle before manually resending. Old local records are
preserved without automatic upload.

## User flow and regression checks

1. As A, choose a real graduate in People, write a request, review/edit, then send.
   The request/contact must not be created before confirmation.
2. As B, open **Your Circle → Requests received → Open chat** and reply. A opens
   **Your guidance requests → Open chat** and sees the reply. Send a follow-up.
3. Confirm another account cannot read or write that conversation. A can hide the
   request without deleting B's thread; B's new reply brings it back for A.
4. Check blank/oversized messages and failed-network retries. Drafts remain while
   the chat screen is mounted; there is no persistent offline outbox.
5. Use [request_delivery_permissions.sql](../supabase/tests/request_delivery_permissions.sql)
   for current participant/privacy/chat assertions. The original
   [guidance_requests_permissions.sql](../supabase/tests/guidance_requests_permissions.sql)
   covers initial demo/private request behavior, not all later sharing rules.

Circle/chat refreshes on focus, foreground return, and every five seconds while
open, plus manual Refresh. It does not provide push notifications. Full chat and
invitation details are in [request-delivery.md](request-delivery.md).
