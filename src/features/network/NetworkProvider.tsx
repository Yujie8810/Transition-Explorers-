import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { CheckIn, HelpRequest, RequestDraft, RequestDecision, ChatMessage, CheckInDraft, CheckInTimeProposal } from '../../types';
import { sampleGuides } from '../../data/sampleData';
import { addCircleContact, fetchCircleContacts, removeCircleContact,
  fetchGuidanceRequests, saveGuidanceRequest, dismissGuidanceRequest, fetchIncomingRequests, respondToGuidanceRequest,
  fetchCheckIns, saveRemoteCheckIn, cancelRemoteCheckIn, fetchIncomingCheckIns, respondToCheckIn, fetchRequestMessages, sendRequestMessage, fetchCheckInTimeProposals, proposeCheckInTime, respondToCheckInTimeProposal } from './networkApi';

type NetworkData = { contactIds: string[]; requests: HelpRequest[]; inbox: HelpRequest[]; checkIns: CheckIn[]; incomingCheckIns: CheckIn[]; messages: ChatMessage[]; timeProposals: CheckInTimeProposal[] };
const emptyData: NetworkData = { contactIds: [], requests: [], inbox: [], checkIns: [], incomingCheckIns: [], messages: [], timeProposals: [] };
type NetworkContextValue = NetworkData & {
  ready: boolean;
  loadError: string;
  reload: () => void;
  refresh: () => Promise<void>;
  respondToRequest: (id: string, decision: RequestDecision, response: string) => Promise<void>;
  addContact: (guideId: string) => Promise<void>;
  removeContact: (guideId: string) => Promise<void>;
  saveRequest: (request: RequestDraft) => Promise<void>;
  dismissRequest: (id: string) => Promise<void>;
  saveCheckIn: (checkIn: CheckInDraft, id?: string) => Promise<CheckIn>;
  cancelCheckIn: (id: string) => Promise<void>;
  respondToCheckIn: (id: string, decision: 'accepted' | 'declined', revision: number) => Promise<void>;
  proposeTime: (id: string, revision: number, startsAt: string, duration: 15 | 30) => Promise<void>;
  respondToTimeProposal: (id: string, decision: 'accepted' | 'rejected') => Promise<void>;
  sendMessage: (id: string, body: string) => Promise<void>;
};
const NetworkContext = createContext<NetworkContextValue | null>(null);
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
// The database also verifies that a UUID belongs to an existing profile.
const isGuide = (id: string) => sampleGuides.some((guide) => guide.id === id)
  || /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);

export function NetworkProvider({ children, accountId }: { children: ReactNode; accountId: string }) {
  const [data, setData] = useState(emptyData);
  const current = useRef(data);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const active = useRef(false);
  const loaded = useRef(false);
  const pending = useRef(0);
  // Old AsyncStorage Circle records remain untouched; there is no silent upload.
  const checkInRetry = useRef<{ signature: string; token: string } | null>(null);
  // Keep this token after a failed HTTP response, until the same draft succeeds.
  const proposalRetries = useRef(new Map<string, { signature: string; token: string }>());
  const messageRetries = useRef(new Map<string, { body: string; token: string }>());
  const requestRetry = useRef<{ signature: string; token: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    active.current = true;
    loaded.current = false;
    setReady(false);
    setLoadError('');

    // Every Circle feature now loads remotely. A fresh device needs no local data.
    // Wait for all sources; never write through an incomplete load.
    Promise.all([fetchCircleContacts(accountId), fetchGuidanceRequests(accountId), fetchCheckIns(accountId), fetchIncomingRequests(accountId), fetchIncomingCheckIns(accountId), fetchRequestMessages(accountId), fetchCheckInTimeProposals(accountId)])
      .then(([contactIds, requests, checkIns, inbox, incomingCheckIns, messages, timeProposals]) => {
        if (cancelled) return;
        const next = { contactIds: contactIds.filter(id => id !== accountId), requests, checkIns, inbox, incomingCheckIns, messages, timeProposals };
        current.current = next;
        setData(next);
        loaded.current = true;
        setReady(true);
      }).catch(() => {
        if (!cancelled) setLoadError('Your circle could not be loaded. Please retry before making changes.');
      });
    // Root remounts this provider on account changes. Ignore the old account's results.
    return () => { cancelled = true; active.current = false; loaded.current = false; };
  }, [accountId, attempt]);

  const commit = (next: NetworkData) => {
    if (!active.current) return;
    current.current = next;
    setData(next);
  };

  // Serialize mutations so a slow add cannot overwrite a later remove or request.
  const enqueue = <T,>(action: () => Promise<T>): Promise<T> => {
    pending.current += 1;
    const task = queue.current.then(async () => {
      if (!active.current || !loaded.current) throw new Error('Your circle is still loading. Please try again.');
      return await action();
    }).finally(() => { pending.current -= 1; });
    queue.current = task.then(() => {}, () => {});
    return task;
  };

  const addContact = async (guideId: string) => {
    ensureGuide(guideId);
    await addCircleContact(accountId, guideId);
    // Show success only after the database accepts the write.
    commit({ ...current.current, contactIds: [...new Set([...current.current.contactIds, guideId])] });
  };
  const ensureGuide = (guideId: string) => {
    if (guideId === accountId) throw new Error('You cannot add yourself or send yourself a request.');
    if (!isGuide(guideId)) throw new Error('This graduate is no longer available.');
  };

  return <NetworkContext.Provider value={{
    ...data, ready, loadError, reload: () => {
      // Reloading during a write could replace newer state with an older snapshot.
      if (pending.current) return;
      loaded.current = false;
      setReady(false);
      setAttempt(value => value + 1);
    },
    refresh: () => enqueue(async () => {
      const [contactIds, requests, checkIns, inbox, incomingCheckIns, messages, timeProposals] = await Promise.all([
        fetchCircleContacts(accountId), fetchGuidanceRequests(accountId), fetchCheckIns(accountId), fetchIncomingRequests(accountId), fetchIncomingCheckIns(accountId), fetchRequestMessages(accountId), fetchCheckInTimeProposals(accountId),
      ]);
      commit({ contactIds: contactIds.filter(id => id !== accountId), requests, checkIns, inbox, incomingCheckIns, messages, timeProposals });
    }),
    proposeTime: (id, revision, startsAt, duration) => enqueue(async () => {
      const meeting = current.current.incomingCheckIns.find(item => item.id === id);
      if (!meeting || meeting.status === 'cancelled') throw new Error('This invitation is unavailable.');
      const start = Date.parse(startsAt);
      if (!Number.isFinite(start) || start <= Date.now() || ![15, 30].includes(duration)) throw new Error('Choose a valid future time and duration.');
      if (start === Date.parse(meeting.startsAt) && duration === meeting.durationMinutes) throw new Error('Choose a different time or duration.');
      const signature = JSON.stringify({ revision, startsAt, duration });
      let retry = proposalRetries.current.get(id);
      if (retry?.signature !== signature) { retry = { signature, token: newId() }; proposalRetries.current.set(id, retry); }
      const proposal = await proposeCheckInTime(accountId, id, revision, new Date(start).toISOString(), duration, retry.token);
      proposalRetries.current.delete(id);
      commit({ ...current.current, timeProposals: [...current.current.timeProposals.filter(item => item.id !== proposal.id), proposal] });
    }),
    respondToTimeProposal: (id, decision) => enqueue(async () => {
      const proposal = current.current.timeProposals.find(item => item.id === id);
      if (!proposal || !current.current.checkIns.some(item => item.id === proposal.checkInId)) throw new Error('Only the original sender can respond to this proposal.');
      const { proposal: saved, checkIn } = await respondToCheckInTimeProposal(accountId, id, decision);
      commit({ ...current.current,
        timeProposals: current.current.timeProposals.map(item => item.id === id ? saved : item),
        checkIns: current.current.checkIns.map(item => item.id === checkIn.id ? checkIn : item),
      });
    }),
    sendMessage: (id, body) => enqueue(async () => {
      const clean = body.trim();
      if (!clean || clean.length > 5000) throw new Error('Write a message using 1–5000 characters.');
      const request = [...current.current.requests, ...current.current.inbox].find(item => item.id === id);
      if (!request?.delivered) throw new Error('Chat is available only for delivered requests to real people.');
      let retry = messageRetries.current.get(id);
      if (retry?.body !== clean) { retry = { body: clean, token: newId() }; messageRetries.current.set(id, retry); }
      const message = await sendRequestMessage(accountId, id, clean, retry.token);
      messageRetries.current.delete(id);
      commit({ ...current.current, messages: [...current.current.messages.filter(item => item.id !== message.id), message] });
    }),
    respondToCheckIn: (id, decision, revision) => enqueue(async () => {
      if (!current.current.incomingCheckIns.some(item => item.id === id)) throw new Error('This invitation is unavailable.');
      const saved = await respondToCheckIn(accountId, id, decision, revision);
      commit({ ...current.current, incomingCheckIns: current.current.incomingCheckIns.map(item => item.id === id ? saved : item) });
    }),
    respondToRequest: (id, decision, response) => enqueue(async () => {
      const request = current.current.inbox.find(item => item.id === id);
      if (!request) throw new Error('This request is no longer available.');
      if (request.kind !== 'check-in' || !['accepted', 'declined'].includes(decision)) {
        throw new Error('Choose a valid response for this request.');
      }
      if (response.trim().length > 5000) {
        throw new Error('Write a response using 1–5000 characters.');
      }
      const saved = await respondToGuidanceRequest(accountId, id, decision, response);
      commit({ ...current.current, inbox: current.current.inbox.map(item => item.id === id ? saved : item) });
    }),
    addContact: (guideId) => enqueue(() => addContact(guideId)),
    removeContact: (guideId) => enqueue(async () => {
      if (current.current.checkIns.some(item => !['declined', 'cancelled'].includes(item.status ?? '') && item.guideId === guideId
        && Date.parse(item.startsAt) + item.durationMinutes * 60000 > Date.now())) {
        throw new Error('Cancel upcoming check-ins before removing this contact.');
      }
      // This is early UI feedback; a database trigger checks current server plans too.
      await removeCircleContact(accountId, guideId);
      commit({ ...current.current, contactIds: current.current.contactIds.filter(id => id !== guideId) });
    }),
    saveRequest: (request) => enqueue(async () => {
      ensureGuide(request.guideId);
      if (!request.message.trim()) throw new Error('Please enter a message.');
      const message = request.message.trim();
      if (message.length > 2000) throw new Error('Keep your request within 2000 characters.');
      if (!['advice', 'check-in'].includes(request.kind)) throw new Error('Choose a request type.');
      const clean = { ...request, message };
      const signature = JSON.stringify(clean);
      if (requestRetry.current?.signature !== signature) {
        requestRetry.current = { signature, token: newId() };
      }
      // The server commits both rows, or neither. Do not save a local request too.
      const saved = await saveGuidanceRequest(accountId, clean, requestRetry.current.token);
      requestRetry.current = null;
      commit({ ...current.current,
        contactIds: [...new Set([...current.current.contactIds, saved.guideId])],
        requests: [...current.current.requests.filter(item => item.id !== saved.id), saved] });
    }),
    dismissRequest: (id) => enqueue(async () => {
      await dismissGuidanceRequest(accountId, id);
      commit({ ...current.current, requests: current.current.requests.filter(item => item.id !== id) });
    }),
    saveCheckIn: (checkIn, id) => enqueue(async () => {
      const previous = current.current;
      ensureGuide(checkIn.guideId);
      const start = Date.parse(checkIn.startsAt);
      if (!checkIn.topic.trim()) throw new Error('Please enter a topic.');
      if (checkIn.topic.trim().length > 200) throw new Error('Keep the topic within 200 characters.');
      if (![15, 30].includes(checkIn.durationMinutes) || !Number.isFinite(start) || start <= Date.now()) {
        throw new Error('Choose a future date and time.');
      }
      if (!previous.contactIds.includes(checkIn.guideId)) throw new Error('Add this graduate to your circle first.');
      if (id && !previous.checkIns.some((item) => item.id === id)) throw new Error('This check-in no longer exists.');
      if (id && previous.checkIns.find(item => item.id === id)?.guideId !== checkIn.guideId) {
        throw new Error('Create a new check-in to choose a different contact.');
      }
      if ([...previous.checkIns, ...previous.incomingCheckIns.filter(item => item.status === 'accepted')].some((item) => !['declined', 'cancelled'].includes(item.status ?? '') && item.id !== id
        && start < Date.parse(item.startsAt) + item.durationMinutes * 60000
        && start + checkIn.durationMinutes * 60000 > Date.parse(item.startsAt))) {
        throw new Error('You already have a check-in during this time. Choose another time.');
      }
      const clean = { ...checkIn, topic: checkIn.topic.trim(), startsAt: new Date(start).toISOString() };
      const signature = JSON.stringify({ ...clean, id });
      if (checkInRetry.current?.signature !== signature) {
        checkInRetry.current = { signature, token: newId() };
      }
      // The server checks time/contact/overlap again using the latest database state.
      const saved = await saveRemoteCheckIn(accountId, clean, checkInRetry.current.token, id);
      checkInRetry.current = null;
      commit({ ...current.current,
        checkIns: [...current.current.checkIns.filter(item => item.id !== saved.id), saved] });
      return saved;
    }),
    cancelCheckIn: (id) => enqueue(async () => {
      await cancelRemoteCheckIn(accountId, id);
      commit({ ...current.current, checkIns: current.current.checkIns.flatMap(item => item.id !== id ? [item]
        : item.delivered ? [{ ...item, status: 'cancelled' as const }] : []) });
    }),
  }}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) throw new Error('useNetwork requires NetworkProvider');
  return context;
}
