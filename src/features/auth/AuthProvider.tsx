import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { createAccountStore, DemoAccount, Registration } from './accountStore';

type AuthContextValue = {
  account: DemoAccount | null;
  ready: boolean;
  busy: boolean;
  loadError: string;
  reload: () => void;
  signIn: (email: string) => Promise<void>;
  signUp: (input: Registration) => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createAccountStore(AsyncStorage));
  const [account, setAccount] = useState<DemoAccount | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    setReady(false); setLoadError('');
    store.restore().then(saved => {
      if (active) { setAccount(saved); setReady(true); }
    }).catch(() => {
      if (active) setLoadError('Your account could not be loaded. Please try again.');
    });
    return () => { active = false; };
  }, [store, attempt]);

  const run = async (action: () => Promise<DemoAccount | null>) => {
    if (!ready) throw new Error('Wait for your accounts to load.');
    if (pending.current) throw new Error('An account action is already in progress.');
    pending.current = true; setBusy(true);
    try { setAccount(await action()); }
    finally { pending.current = false; setBusy(false); }
  };

  return <AuthContext.Provider value={{ account, ready, busy, loadError,
    reload: () => setAttempt(value => value + 1),
    signIn: email => run(() => store.signIn(email)),
    signUp: input => run(() => store.signUp(input)),
    signOut: () => run(() => store.signOut()),
  }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth requires AuthProvider');
  return value;
}
