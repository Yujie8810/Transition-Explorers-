import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

export type UserProfile = {
  name: string;
  affiliation: 'Student' | 'Graduate';
  program: string;
};

// A fictional local profile lets Profile be developed before authentication.
// need to implment: Aproteem, connect authenticated users to this shared contract.
// This storage key is device-wide; account isolation belongs to the auth integration.
const demoProfile: UserProfile = { name: 'Aalvee Ahtav', affiliation: 'Student', program: 'Computer Science' };
const storageKey = 'transition-explorers.profile.v1';
const ProfileContext = createContext<{
  profile: UserProfile;
  ready: boolean;
  loadError: string;
  reload: () => void;
  updateProfile: (profile: UserProfile) => Promise<void>;
} | null>(null);

function readProfile(raw: string | null): UserProfile {
  if (!raw) return demoProfile;
  const value = JSON.parse(raw);
  if (!value || typeof value.name !== 'string' || !value.name.trim()
    || !['Student', 'Graduate'].includes(value.affiliation) || typeof value.program !== 'string') {
    throw new Error('Invalid profile data');
  }
  return { name: value.name, affiliation: value.affiliation, program: value.program };
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(demoProfile);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setReady(false);
    setLoadError('');
    AsyncStorage.getItem(storageKey).then(raw => {
      const stored = readProfile(raw);
      if (active) { setProfile(stored); setReady(true); }
    }).catch(() => {
      if (active) setLoadError('Your profile could not be loaded. Try again before editing.');
    });
    return () => { active = false; };
  }, [attempt]);

  const updateProfile = async (next: UserProfile) => {
    if (!ready) throw new Error('Wait for your profile to load.');
    const clean = { ...next, name: next.name.trim(), program: next.program.trim() };
    if (!clean.name || clean.name.length > 80 || !clean.program || clean.program.length > 100
      || !['Student', 'Graduate'].includes(clean.affiliation)) {
      throw new Error('Enter a name and program, and select Student or Graduate.');
    }
    // Only update the visible profile after storage succeeds; failed edits stay in the form.
    await AsyncStorage.setItem(storageKey, JSON.stringify(clean));
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
