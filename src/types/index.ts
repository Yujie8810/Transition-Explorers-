// Shared contracts: agree on changes with teammates before editing these types.
// need to implment: module owners, agree on additional fields for answers,
// saved items, users, connections, and progress before wiring shared state.
// IDs link records across modules; startsAt should use an ISO date/time string.
export type Topic = 'First job' | 'Interviews' | 'Work life';
export type Advice = { id: string; title: string; topic: Topic; body: string; authorId: string };
export type Answer = { id: string; adviceId: string; guideId: string; body: string };
export type Guide = { id: string; name: string; role: string; expertise: string[]; gradYear?: number; yearsExperience?: number; bio?: string; listed?: boolean };
export type RequestDraft = { guideId: string; message: string; kind: 'advice' | 'check-in' };
export type RequestDecision = 'accepted' | 'declined';
export type HelpRequest = RequestDraft & {
  id: string; senderId?: string; recipientId?: string | null;
  status?: 'pending' | 'answered' | RequestDecision; response?: string | null;
  respondedAt?: string | null; delivered?: boolean;
};
export type CheckInDraft = { guideId: string; topic: string; startsAt: string; durationMinutes: 15 | 30 };
export type CheckIn = CheckInDraft & {
  id: string; senderId?: string; recipientId?: string | null; delivered?: boolean;
  status?: 'personal' | 'pending' | 'accepted' | 'declined' | 'cancelled'; revision?: number;
};
export type ChatMessage = { id: string; requestId: string; senderId: string; body: string; createdAt: string };

export type CheckInTimeProposal = {
  id: string; checkInId: string; proposerId: string; baseRevision: number;
  startsAt: string; durationMinutes: 15 | 30;
  status: 'pending' | 'accepted' | 'rejected' | 'superseded';
};
