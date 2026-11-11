import { supabase } from '../../lib/supabase';
import type { CheckIn, HelpRequest, RequestDraft, RequestDecision, ChatMessage, CheckInDraft, CheckInTimeProposal } from '../../types';

function getClient() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function fetchCircleContacts(accountId: string): Promise<string[]> {
  const { data, error } = await getClient()
    .from('circle_contacts')
    .select('guide_id')
    // The filter scopes a late request to the account that started it.
    // RLS independently enforces access; client filters are not permissions.
    .eq('user_id', accountId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []).map(row => row.guide_id as string);
}

export async function addCircleContact(accountId: string, guideId: string) {
  const { error } = await getClient()
    .from('circle_contacts')
    // Explicit ownership prevents a late action from becoming another user's save
    // if the signed-in session changes. RLS rejects a mismatched user_id.
    .upsert({ user_id: accountId, guide_id: guideId }, {
      onConflict: 'user_id,guide_id',
      ignoreDuplicates: true, // Adding an existing contact is safe to retry.
    });
  if (error) throw error;
}

export async function removeCircleContact(accountId: string, guideId: string) {
  const { error } = await getClient()
    .from('circle_contacts')
    .delete()
    .eq('user_id', accountId)
    .eq('guide_id', guideId);
  // Zero rows is fine: another device may already have removed this contact.
  if (error) throw new Error(error.message);
}

type RequestRow = {
  id: string; user_id: string; guide_id: string; recipient_id: string | null;
  kind: HelpRequest['kind']; message: string; status: HelpRequest['status'];
  response: string | null; responded_at: string | null; delivered_at: string | null;
};
const requestColumns = 'id, user_id, guide_id, recipient_id, kind, message, status, response, responded_at, delivered_at';
const mapRequest = (row: RequestRow): HelpRequest => ({
  id: row.id, senderId: row.user_id, recipientId: row.recipient_id,
  guideId: row.guide_id, kind: row.kind, message: row.message,
  status: row.status, response: row.response, respondedAt: row.responded_at, delivered: !!row.delivered_at,
});
export async function fetchGuidanceRequests(accountId: string): Promise<HelpRequest[]> {
  const { data, error } = await getClient().from('guidance_requests')
    .select(requestColumns).eq('user_id', accountId).neq('guide_id', accountId).eq('sender_hidden', false)
    .order('created_at').order('id');
  if (error) throw error;
  return (data ?? []).map(row => mapRequest(row as RequestRow));
}
export async function fetchIncomingRequests(accountId: string): Promise<HelpRequest[]> {
  const { data, error } = await getClient().from('guidance_requests')
    .select(requestColumns).eq('recipient_id', accountId).neq('user_id', accountId)
    .not('delivered_at', 'is', null).order('created_at').order('id');
  if (error) throw error;
  return (data ?? []).map(row => mapRequest(row as RequestRow));
}
export async function respondToGuidanceRequest(
  accountId: string, id: string, decision: RequestDecision, response: string,
): Promise<HelpRequest> {
  const { data, error } = await getClient().rpc('respond_to_guidance_request', {
    p_account_id: accountId, p_request_id: id, p_decision: decision, p_response: response.trim(),
  }).single();
  if (error) throw new Error(error.message);
  return mapRequest(data as RequestRow);
}

export async function saveGuidanceRequest(
  accountId: string, request: RequestDraft, clientToken: string,
): Promise<HelpRequest> {
  // Do not split this into two HTTP writes: the RPC saves the request and its
  // contact atomically. The same token makes a retry after a lost response safe.
  const { data, error } = await getClient().rpc('save_guidance_request', {
    p_account_id: accountId, p_guide_id: request.guideId, p_kind: request.kind,
    p_message: request.message.trim(), p_client_token: clientToken,
  }).single();
  if (error) throw error;
  return mapRequest(data as RequestRow);
}

export async function dismissGuidanceRequest(accountId: string, id: string) {
  const { error } = await getClient().rpc('hide_guidance_request', {
    p_account_id: accountId, p_request_id: id,
  });
  // Hide only the sender's copy; the recipient keeps their request and response.
  if (error) throw error;
}

type CheckInRow = {
  id: string; user_id: string; recipient_id: string | null; delivered_at: string | null;
  guide_id: string; topic: string; duration_minutes: 15 | 30; starts_at: string;
  status: CheckIn['status']; revision: number;
};
const checkInColumns = 'id, user_id, recipient_id, delivered_at, guide_id, topic, duration_minutes, starts_at, status, revision';
const mapCheckIn = (row: CheckInRow): CheckIn => ({
  id: row.id, senderId: row.user_id, recipientId: row.recipient_id, delivered: !!row.delivered_at,
  guideId: row.guide_id, topic: row.topic, durationMinutes: row.duration_minutes,
  startsAt: row.starts_at, status: row.status, revision: row.revision,
});
export async function fetchCheckIns(accountId: string): Promise<CheckIn[]> {
  const { data, error } = await getClient().from('check_ins')
    .select(checkInColumns).eq('user_id', accountId).order('starts_at').order('id');
  if (error) throw error;
  return (data ?? []).map(row => mapCheckIn(row as CheckInRow));
}
export async function fetchIncomingCheckIns(accountId: string): Promise<CheckIn[]> {
  const { data, error } = await getClient().from('check_ins')
    .select(checkInColumns).eq('recipient_id', accountId).not('delivered_at', 'is', null)
    .order('starts_at').order('id');
  if (error) throw error;
  return (data ?? []).map(row => mapCheckIn(row as CheckInRow));
}
export async function respondToCheckIn(accountId: string, id: string, decision: 'accepted' | 'declined', revision: number): Promise<CheckIn> {
  const { data, error } = await getClient().rpc('respond_to_check_in', {
    p_account_id: accountId, p_check_in_id: id, p_decision: decision, p_expected_revision: revision,
  }).single();
  if (error?.code === '23P01') throw new Error('You already have a check-in during this time.');
  if (error) throw new Error(error.message);
  return mapCheckIn(data as CheckInRow);
}

export async function saveRemoteCheckIn(
  accountId: string, checkIn: CheckInDraft, clientToken: string, id?: string,
): Promise<CheckIn> {
  const { data, error } = await getClient().rpc('save_check_in', {
    p_account_id: accountId, p_guide_id: checkIn.guideId, p_topic: checkIn.topic.trim(),
    p_duration_minutes: checkIn.durationMinutes, p_starts_at: checkIn.startsAt,
    p_client_token: clientToken, p_check_in_id: id ?? null,
  }).single();
  // The server remains authoritative if another device added a conflicting plan
  // or removed the contact after this screen loaded.
  if (error?.code === '23P01') throw new Error('You already have a check-in during this time. Choose another time.');
  if (error) throw new Error(error.message);
  return mapCheckIn(data as CheckInRow);
}

export async function cancelRemoteCheckIn(accountId: string, id: string) {
  const { error } = await getClient().rpc('cancel_check_in', { p_account_id: accountId, p_check_in_id: id });
  if (error) throw new Error(error.message);
}

type MessageRow = { id: string; request_id: string; sender_id: string; body: string; created_at: string };
const mapMessage = (row: MessageRow): ChatMessage => ({
  id: row.id, requestId: row.request_id, senderId: row.sender_id, body: row.body, createdAt: row.created_at,
});
export async function fetchRequestMessages(_accountId: string): Promise<ChatMessage[]> {
  // RLS returns messages only from this account's delivered requests.
  const { data, error } = await getClient().from('guidance_messages')
    .select('id, request_id, sender_id, body, created_at').order('created_at').order('id');
  if (error) throw error;
  return (data ?? []).map(row => mapMessage(row as MessageRow));
}
export async function sendRequestMessage(accountId: string, requestId: string, body: string, token: string): Promise<ChatMessage> {
  const { data, error } = await getClient().rpc('send_guidance_message', {
    p_account_id: accountId, p_request_id: requestId, p_body: body.trim(), p_client_token: token,
  }).single();
  if (error) throw new Error(error.message);
  return mapMessage(data as MessageRow);
}

type ProposalRow = {
  id: string; check_in_id: string; proposer_id: string; base_revision: number;
  starts_at: string; duration_minutes: 15 | 30; status: CheckInTimeProposal['status'];
};
const mapProposal = (row: ProposalRow): CheckInTimeProposal => ({
  id: row.id, checkInId: row.check_in_id, proposerId: row.proposer_id, baseRevision: row.base_revision,
  startsAt: row.starts_at, durationMinutes: row.duration_minutes, status: row.status,
});
export async function fetchCheckInTimeProposals(_accountId: string): Promise<CheckInTimeProposal[]> {
  const { data, error } = await getClient().from('check_in_time_proposals')
    .select('id, check_in_id, proposer_id, base_revision, starts_at, duration_minutes, status').order('created_at').order('id');
  if (error) throw error;
  return (data ?? []).map(row => mapProposal(row as ProposalRow));
}
export async function proposeCheckInTime(accountId: string, id: string, revision: number,
  startsAt: string, durationMinutes: 15 | 30, token: string): Promise<CheckInTimeProposal> {
  const { data, error } = await getClient().rpc('propose_check_in_time', {
    p_account_id: accountId, p_check_in_id: id, p_expected_revision: revision,
    p_starts_at: startsAt, p_duration_minutes: durationMinutes, p_client_token: token,
  }).single();
  if (error) throw new Error(error.message);
  return mapProposal(data as ProposalRow);
}
export async function respondToCheckInTimeProposal(accountId: string, id: string, decision: 'accepted' | 'rejected'): Promise<{ proposal: CheckInTimeProposal; checkIn: CheckIn }> {
  const { data, error } = await getClient().rpc('respond_to_check_in_time_proposal', {
    p_account_id: accountId, p_proposal_id: id, p_decision: decision,
  });
  if (error?.code === '23P01') throw new Error('One of you already has a check-in during this time. Choose another time.');
  if (error) throw new Error(error.message);
  return { proposal: mapProposal(data.proposal as ProposalRow), checkIn: mapCheckIn(data.check_in as CheckInRow) };
}
