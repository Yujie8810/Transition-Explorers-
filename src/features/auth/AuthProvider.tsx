import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase, supabaseConfigurationError } from '../../lib/supabase';
import { accountFromUser, Account, normalizeEmail, Registration, validEmail, validateRegistration } from './accountStore';

type AuthContextValue = {
  account: Account | null;
  ready: boolean;
  busy: boolean;
  loadError: string;
  reload: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: Registration) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(false);

  useEffect(() => {
    const client = supabase;
    setReady(false); setLoadError('');
    if (!client) { setLoadError(supabaseConfigurationError); return; }
    let active = true;
    let revision = 0;
    // Keep this callback synchronous: awaiting another Auth call can deadlock the SDK lock.
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      revision++;
      setAccount(previous => {
        if (!session) return null;
        // Profile edits are owned by ProfileProvider; refresh events must not reset its form.
        return previous?.id === session.user.id ? previous : accountFromUser(session.user);
      });
    });
    const startedAt = revision;
    client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) throw error;
      if (revision === startedAt) setAccount(data.session ? accountFromUser(data.session.user) : null);
      setReady(true);
    }).catch(() => {
      if (active) setLoadError('Your session could not be loaded. Check your connection and try again.');
    });
    const refresh = (state: string | null | undefined) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    };
    const listener = Platform.OS !== 'web' ? AppState.addEventListener('change', refresh) : null;
    if (Platform.OS !== 'web') refresh(AppState.currentState);
    return () => {
      active = false; subscription.unsubscribe(); listener?.remove();
      if (Platform.OS !== 'web') client.auth.stopAutoRefresh();
    };
  }, [attempt]);

  const run = async <T,>(action: () => Promise<T>): Promise<T> => {
    if (!ready || !supabase) throw new Error('Wait for your session to load.');
    if (pending.current) throw new Error('An account action is already in progress.');
    pending.current = true; setBusy(true);
    try { return await action(); }
    finally { pending.current = false; setBusy(false); }
  };

  return <AuthContext.Provider value={{ account, ready, busy, loadError,
    reload: () => setAttempt(value => value + 1),
    signIn: (input, password) => run(async () => {
      const email = normalizeEmail(input);
      if (!validEmail(email)) throw new Error('Enter a valid email address.');
      if (!password) throw new Error('Enter your password.');
      const { data, error } = await supabase!.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setAccount(accountFromUser(data.user));
    }),
    signUp: input => run(async () => {
      const clean = validateRegistration(input);
      const { data, error } = await supabase!.auth.signUp({
        email: clean.email, password: clean.password,
        options: { data: { full_name: clean.name, major: clean.program, affiliation: clean.affiliation } },
      });
      if (error) throw error;
      // Confirmation-enabled projects return a user but no session. Keep protected routes closed.
      if (data.session) setAccount(accountFromUser(data.session.user));
      return { needsConfirmation: !data.session };
    }),
    signOut: () => run(async () => {
      const { error } = await supabase!.auth.signOut({ scope: 'local' });
      if (error) throw error;
      setAccount(null);
    }),
  }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth requires AuthProvider');
  return value;
}
