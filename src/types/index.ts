// Shared contracts: agree on changes with teammates before editing these types.
// need to implment: module owners, agree on additional fields for answers,
// saved items, users, connections, and progress before wiring shared state.
// IDs link records across modules; startsAt should use an ISO date/time string.
export type Topic = 'First job' | 'Interviews' | 'Work life';
export type Advice = { id: string; title: string; topic: Topic; body: string; authorId: string };
export type Guide = { id: string; name: string; role: string; expertise: string[] };
export type HelpRequest = { id: string; guideId: string; message: string; kind: 'advice' | 'check-in' };
export type CheckIn = { id: string; guideId: string; topic: string; startsAt: string; durationMinutes: 15 | 30 };
