import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { CheckIn, HelpRequest } from '../../types';
import { sampleGuides } from '../../data/sampleData';

type NetworkData = { contactIds: string[]; requests: HelpRequest[]; checkIns: CheckIn[] };
const emptyData: NetworkData = { contactIds: [], requests: [], checkIns: [] };
type NetworkContextValue = NetworkData & {
  ready: boolean;
  loadError: string;
  reload: () => void;
  addContact: (guideId: string) => Promise<void>;
  removeContact: (guideId: string) => Promise<void>;
  saveRequest: (request: Omit<HelpRequest, 'id'>) => Promise<void>;
  dismissRequest: (id: string) => Promise<void>;
  saveCheckIn: (checkIn: Omit<CheckIn, 'id'>, id?: string) => Promise<void>;
  cancelCheckIn: (id: string) => Promise<void>;
};
const NetworkContext = createContext<NetworkContextValue | null>(null);
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const isGuide = (id: string) => sampleGuides.some((guide) => guide.id === id);

function readData(raw: string): NetworkData {
  const data = JSON.parse(raw) as NetworkData;
  if (!data || !Array.isArray(data.contactIds) || !Array.isArray(data.requests) || !Array.isArray(data.checkIns)
    || !data.contactIds.every((id) => typeof id === 'string')
    || !data.requests.every((r) => r && typeof r.id === 'string' && typeof r.guideId === 'string'
      && typeof r.message === 'string' && ['advice', 'check-in'].includes(r.kind))
    || !data.checkIns.every((c) => c && typeof c.id === 'string' && typeof c.guideId === 'string'
      && typeof c.topic === 'string' && typeof c.startsAt === 'string'
      && Number.isFinite(Date.parse(c.startsAt)) && [15, 30].includes(c.durationMinutes))) {
    throw new Error('Invalid saved network data');
  }
  return data;
}

export function NetworkProvider({ children, accountId }: { children: ReactNode; accountId: string }) {
  const storageKey = `transition-explorers.network.v1.${accountId}`;
  const [data, setData] = useState(emptyData);
  const current = useRef(data);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoadError('');
    AsyncStorage.getItem(storageKey).then((raw) => {
      const saved = raw ? readData(raw) : emptyData;
      if (active) { current.current = saved; setData(saved); setReady(true); }
    }).catch(() => {
      if (active) setLoadError('Your circle could not be loaded. Please retry before making changes.');
    });
    return () => { active = false; };
  }, [attempt, storageKey]);

  const update = (change: (previous: NetworkData) => NetworkData) => {
    const task = queue.current.then(async () => {
      if (!ready) throw new Error('Your circle is still loading. Please try again.');
      const next = change(current.current);
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      current.current = next;
      setData(next);
    });
    queue.current = task.catch(() => {});
    return task;
  };
  const ensureGuide = (guideId: string) => {
    if (!isGuide(guideId)) throw new Error('This graduate is no longer available.');
  };

  return <NetworkContext.Provider value={{
    ...data, ready, loadError, reload: () => setAttempt((value) => value + 1),
    addContact: (guideId) => update((previous) => {
      ensureGuide(guideId);
      return { ...previous, contactIds: [...new Set([...previous.contactIds, guideId])] };
    }),
    removeContact: (guideId) => update((previous) => {
      if (previous.checkIns.some((item) => item.guideId === guideId && Date.parse(item.startsAt) > Date.now())) {
        throw new Error('Cancel upcoming check-ins before removing this contact.');
      }
      return { ...previous, contactIds: previous.contactIds.filter((id) => id !== guideId) };
    }),
    saveRequest: (request) => update((previous) => {
      ensureGuide(request.guideId);
      if (!request.message.trim()) throw new Error('Please enter a message.');
      return { ...previous, contactIds: [...new Set([...previous.contactIds, request.guideId])],
        requests: [...previous.requests, { ...request, message: request.message.trim(), id: newId() }] };
    }),
    dismissRequest: (id) => update((previous) => ({ ...previous, requests: previous.requests.filter((r) => r.id !== id) })),
    saveCheckIn: (checkIn, id) => update((previous) => {
      ensureGuide(checkIn.guideId);
      const start = Date.parse(checkIn.startsAt);
      if (!checkIn.topic.trim()) throw new Error('Please enter a topic.');
      if (![15, 30].includes(checkIn.durationMinutes) || !Number.isFinite(start) || start <= Date.now()) {
        throw new Error('Choose a future date and time.');
      }
      if (!previous.contactIds.includes(checkIn.guideId)) throw new Error('Add this graduate to your circle first.');
      if (id && !previous.checkIns.some((item) => item.id === id)) throw new Error('This check-in no longer exists.');
      if (previous.checkIns.some((item) => item.id !== id
        && start < Date.parse(item.startsAt) + item.durationMinutes * 60000
        && start + checkIn.durationMinutes * 60000 > Date.parse(item.startsAt))) {
        throw new Error('You already have a check-in during this time. Choose another time.');
      }
      return { ...previous, checkIns: [...previous.checkIns.filter((item) => item.id !== id),
        { ...checkIn, topic: checkIn.topic.trim(), id: id ?? newId() }] };
    }),
    cancelCheckIn: (id) => update((previous) => ({ ...previous, checkIns: previous.checkIns.filter((item) => item.id !== id) })),
  }}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) throw new Error('useNetwork requires NetworkProvider');
  return context;
}
