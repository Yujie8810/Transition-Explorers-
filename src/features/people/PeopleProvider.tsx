import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { sampleGuides } from '../../data/sampleData';
import type { Guide } from '../../types';
import { fetchDirectory, saveDirectoryProfile } from './peopleApi';

type DirectoryInput = Parameters<typeof saveDirectoryProfile>[1];
const PeopleContext = createContext<{
  guides: Guide[]; people: Guide[]; ready: boolean; loadError: string;
  reload: () => void; save: (input: DirectoryInput) => Promise<void>;
} | null>(null);
export function PeopleProvider({ children, accountId }: { children: ReactNode; accountId: string }) {
  const [remote, setRemote] = useState<Guide[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const active = useRef(false), revision = useRef(0), saving = useRef(false);
  const reload = useCallback(() => {
    const version = ++revision.current;
    setLoadError('');
    fetchDirectory().then(rows => {
      if (!active.current || version !== revision.current) return;
      setRemote(rows); setReady(true);
    }).catch(() => {
      if (active.current && version === revision.current) {
        setLoadError('Community profiles could not be loaded. Demo graduates are still available.');
      }
    });
  }, []);
  useEffect(() => { active.current = true; reload(); return () => { active.current = false; revision.current++; }; }, [reload]);
  const save = async (input: DirectoryInput) => {
    if (!ready || saving.current) throw new Error('Wait for your People profile to load.');
    saving.current = true;
    // Invalidate an earlier refresh before and after writing, so it cannot
    // overwrite the newly committed profile with an older snapshot.
    revision.current++;
    try {
      const guide = await saveDirectoryProfile(accountId, input);
      if (active.current) {
        revision.current++;
        setRemote(rows => [...rows.filter(row => row.id !== accountId), guide]);
      }
    } finally { saving.current = false; }
  };
  return <PeopleContext.Provider value={{
    guides: [...remote, ...sampleGuides], people: [...remote.filter(guide => guide.listed), ...sampleGuides],
    ready, loadError, reload, save,
  }}>{children}</PeopleContext.Provider>;
}
export function usePeople() {
  const value = useContext(PeopleContext);
  if (!value) throw new Error('usePeople requires PeopleProvider');
  return value;
}
