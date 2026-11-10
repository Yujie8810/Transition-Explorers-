import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { sampleAnswers } from '../data/sampleData';
import { useAnswers } from '../features/advice/AnswersProvider';
import { fetchSavedAnswers, saveAnswer, unsaveAnswer } from '../features/advice/adviceApi';

export type SavedItem = { answerId: string; adviceId: string; savedAt: string };
type SavedData = { local: SavedItem[]; remote: SavedItem[] };
type SavedAdviceContextValue = {
  saved: SavedItem[];
  ready: boolean;
  busy: boolean;
  loadError: string;
  reload: () => void;
  isSaved: (answerId: string) => boolean;
  saveAdvice: (answerId: string, adviceId: string) => Promise<void>;
  removeAdvice: (answerId: string) => Promise<void>;
};

const SavedAdviceContext = createContext<SavedAdviceContextValue | null>(null);
const isDemoAnswer = (id: string) => sampleAnswers.some(answer => answer.id === id);

function readLocalSaves(raw: string | null): SavedItem[] {
  if (!raw) return [];
  const value = JSON.parse(raw);
  if (!Array.isArray(value) || !value.every(item => item
    && typeof item.answerId === 'string' && typeof item.adviceId === 'string'
    && typeof item.savedAt === 'string' && Number.isFinite(Date.parse(item.savedAt)))) {
    throw new Error('Invalid saved advice data.');
  }
  return value;
}

export function SavedAdviceProvider({ children, accountId }: { children: ReactNode; accountId: string }) {
  const storageKey = `transition-explorers.saved-advice.v1.${accountId}`;
  const { findAnswer, ready: answersReady } = useAnswers();
  const [data, setData] = useState<SavedData>({ local: [], remote: [] });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const current = useRef(data);
  const pending = useRef(false);
  const loaded = useRef(false);
  const active = useRef(false);
  // Preserve older locally saved real answers without silently uploading them.
  const legacy = useRef<SavedItem[]>([]);

  const reload = () => {
    if (pending.current) return;
    loaded.current = false;
    setReady(false);
    setAttempt(value => value + 1);
  };

  useEffect(() => {
    let cancelled = false;
    active.current = true;
    loaded.current = false;
    setReady(false);
    setLoadError('');

    // Demo answers stay local; real answer saves come from Supabase.
    Promise.all([AsyncStorage.getItem(storageKey), fetchSavedAnswers()])
      .then(([raw, rows]) => {
        const stored = readLocalSaves(raw);
        const next: SavedData = {
          local: stored.filter(item => isDemoAnswer(item.answerId)),
          remote: rows.map(row => ({ answerId: row.answer_id,
            adviceId: row.answers.question_id, savedAt: row.created_at })),
        };
        if (!cancelled) {
          legacy.current = stored.filter(item => !isDemoAnswer(item.answerId));
          current.current = next;
          setData(next);
          loaded.current = true;
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError('Saved advice could not be loaded. Please retry.');
      });

    return () => { cancelled = true; active.current = false; };
  }, [accountId, storageKey, attempt]);

  // Block overlapping changes so a slow save cannot undo a later removal.
  const run = async (action: () => Promise<void>) => {
    if (!active.current || !loaded.current) throw new Error('Wait for saved advice to load.');
    if (pending.current) throw new Error('A saved-advice update is already running.');
    pending.current = true;
    setBusy(true);
    try { await action(); }
    finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  };

  const commit = (next: SavedData) => {
    if (!active.current) return;
    current.current = next;
    setData(next);
  };

  const saveAdvice = async (answerId: string, adviceId: string) => run(async () => {
    const answer = findAnswer(answerId);
    if (!answersReady || answer?.adviceId !== adviceId) {
      throw new Error('This answer is not available to save.');
    }
    const item: SavedItem = { answerId, adviceId, savedAt: new Date().toISOString() };
    if (isDemoAnswer(answerId)) {
      const local = [item, ...current.current.local.filter(saved => saved.answerId !== answerId)];
      await AsyncStorage.setItem(storageKey, JSON.stringify([...local, ...legacy.current]));
      commit({ ...current.current, local });
    } else {
      await saveAnswer(answerId, accountId);
      // Change the visible state only after the database accepts the save.
      if (!current.current.remote.some(saved => saved.answerId === answerId)) {
        commit({ ...current.current, remote: [item, ...current.current.remote] });
      }
    }
  });

  const removeAdvice = async (answerId: string) => run(async () => {
    if (isDemoAnswer(answerId)) {
      const local = current.current.local.filter(item => item.answerId !== answerId);
      await AsyncStorage.setItem(storageKey, JSON.stringify([...local, ...legacy.current]));
      commit({ ...current.current, local });
    } else {
      await unsaveAnswer(answerId, accountId);
      commit({ ...current.current,
        remote: current.current.remote.filter(item => item.answerId !== answerId) });
    }
  });

  const saved = [...data.local, ...data.remote]
    .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));

  return <SavedAdviceContext.Provider value={{ saved, ready, busy, loadError, reload,
    saveAdvice, removeAdvice, isSaved: answerId => saved.some(item => item.answerId === answerId) }}>
    {children}
  </SavedAdviceContext.Provider>;
}

export function useSavedAdvice() {
  const context = useContext(SavedAdviceContext);
  if (!context) throw new Error('useSavedAdvice requires SavedAdviceProvider');
  return context;
}
