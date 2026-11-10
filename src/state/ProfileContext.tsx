import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type UserProfile = {
  name: string;
  affiliation: 'Student' | 'Graduate';
  program: string;
};

const ProfileContext = createContext<{
  profile: UserProfile;
  ready: boolean;
  loadError: string;
  reload: () => void;
  updateProfile: (profile: UserProfile) => Promise<void>;
} | null>(null);

// Root remounts this provider when the authenticated account changes.
export function ProfileProvider({ children, accountId, initialProfile }: {
  children: ReactNode; accountId: string; initialProfile: UserProfile;
}) {
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setReady(false); setLoadError('');
    const load = async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (session?.user.id !== accountId) throw new Error('Your account changed.');
      const affiliation = session.user.user_metadata.affiliation === 'Graduate' ? 'Graduate' : 'Student';
      const query = () => supabase!.from('Profiles').select('full_name, major').eq('id', accountId).maybeSingle();
      let result = await query();
      if (result.error) throw result.error;
      if (!result.data) {
        // Works with or without a signup trigger. Never overwrite an existing profile.
        const { error } = await supabase.from('Profiles').upsert({
          id: accountId, full_name: initialProfile.name, major: initialProfile.program,
        }, { onConflict: 'id', ignoreDuplicates: true });
        if (error) throw error;
        result = await query();
        if (result.error) throw result.error;
      }
      if (!result.data) throw new Error('Your profile is not available yet.');
      if (active) {
        setProfile({ name: result.data.full_name ?? initialProfile.name,
          program: result.data.major ?? initialProfile.program, affiliation });
        setReady(true);
      }
    };
    load().catch(() => {
      if (active) setLoadError('Your profile could not be loaded. Check your connection and retry.');
    });
    return () => { active = false; };
  }, [attempt, accountId, initialProfile]);

  const updateProfile = async (next: UserProfile) => {
    if (!ready || !supabase) throw new Error('Wait for your profile to load.');
    const clean = { ...next, name: next.name.trim(), program: next.program.trim() };
    if (!clean.name || clean.name.length > 80 || !clean.program || clean.program.length > 100
      || !['Student', 'Graduate'].includes(clean.affiliation)) {
      throw new Error('Enter a name and program, and select Student or Graduate.');
    }
    // Ensure a stale form cannot issue a write using another account's live session.
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (session?.user.id !== accountId) throw new Error('Your account changed. Reopen your profile.');
    const { data, error } = await supabase.from('Profiles')
      .update({ full_name: clean.name, major: clean.program }).eq('id', accountId)
      .select('id').single();
    if (error) throw error;
    if (!data) throw new Error('Your profile could not be saved.');
    // Affiliation is self-reported display data, never an authorization role.
    // The team's existing Profiles schema has no affiliation column.
    const { data: { session: latestSession }, error: latestError } = await supabase.auth.getSession();
    if (latestError) throw latestError;
    if (latestSession?.user.id !== accountId) throw new Error('Your account changed. Reopen your profile.');
    const { error: metadataError } = await supabase.auth.updateUser({ data: {
      full_name: clean.name, major: clean.program, affiliation: clean.affiliation,
    } });
    if (metadataError) throw metadataError;
    setProfile(clean);
  };

  return <ProfileContext.Provider value={{ profile, ready, loadError,
    reload: () => setAttempt(value => value + 1), updateProfile }}>
    {children}
  </ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile requires ProfileProvider');
  return context;
}
