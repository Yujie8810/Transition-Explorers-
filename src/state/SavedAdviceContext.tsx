import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';

/**
 * Owners: Mourede + Hoa.
 * Answers ("tips") the user saved, shared by the advice detail and Saved screens
 * and kept on the device between app restarts. Only IDs are stored; screens look up
 * the answer text and author from the data so they never go out of sync.
 */

export type SavedItem = { answerId: string; adviceId: string; savedAt: string };

type SavedAdviceContextValue = {
  saved: SavedItem[];
  isSaved: (answerId: string) => boolean;
  saveAdvice: (answerId: string, adviceId: string) => Promise<void>;
  removeAdvice: (answerId: string) => Promise<void>;
};

const SavedAdviceContext = createContext<SavedAdviceContextValue | null>(null);

function readSaved(raw: string | null): SavedItem[] {
  const saved = raw ? JSON.parse(raw) : [];
  return Array.isArray(saved)
    ? saved.filter(item => item && typeof item.answerId === 'string' && typeof item.adviceId === 'string'
      && typeof item.savedAt === 'string')
    : [];
}

export function SavedAdviceProvider({ children, accountId }: { children: ReactNode; accountId: string }) {
  const storageKey = `transition-explorers.saved-advice.v1.${accountId}`;
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const current = useRef(saved);
  const loading = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    loading.current = AsyncStorage.getItem(storageKey)
      .then(raw => { current.current = readSaved(raw); setSaved(current.current); })
      .catch(() => {}); // Start with nothing saved if saved data cannot be read.
  }, [storageKey]);

  const update = async (change: (previous: SavedItem[]) => SavedItem[]) => {
    await loading.current; // Never overwrite saved tips that have not loaded yet.
    const next = change(current.current);
    await AsyncStorage.setItem(storageKey, JSON.stringify(next));
    current.current = next;
    setSaved(next);
  };

  return <SavedAdviceContext.Provider value={{
    saved,
    isSaved: answerId => saved.some(item => item.answerId === answerId),
    // Newest first; saving the same answer twice keeps one entry.
    saveAdvice: (answerId, adviceId) => update(previous => [
      { answerId, adviceId, savedAt: new Date().toISOString() },
      ...previous.filter(item => item.answerId !== answerId),
    ]),
    removeAdvice: answerId => update(previous => previous.filter(item => item.answerId !== answerId)),
  }}>{children}</SavedAdviceContext.Provider>;
}

export function useSavedAdvice() {
  const context = useContext(SavedAdviceContext);
  if (!context) throw new Error('useSavedAdvice requires SavedAdviceProvider');
  return context;
}
