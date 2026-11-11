import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { useNetwork } from './NetworkProvider';

// Refresh only while the inbox/chat is focused. Serialize refreshes with writes
// in the provider, and leave forms/drafts mounted when a background read fails.
export function useCircleSync() {
  const network = useNetwork();
  const latest = useRef(network);
  latest.current = network;
  const [syncError, setSyncError] = useState('');
  const refresh = useCallback(async () => {
    if (!latest.current.ready) return;
    await latest.current.refresh();
  }, []);
  useFocusEffect(useCallback(() => {
    let active = true, refreshing = false;
    const sync = async () => {
      if (refreshing || (AppState.currentState && AppState.currentState !== 'active')) return;
      refreshing = true;
      try { await refresh(); if (active) setSyncError(''); }
      catch { if (active) setSyncError('Updates could not be loaded. Your draft is kept. Try refreshing.'); }
      finally { refreshing = false; }
    };
    void sync();
    const timer = setInterval(() => void sync(), 5000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void sync(); });
    return () => { active = false; clearInterval(timer); listener.remove(); };
  }, [refresh]));
  return { syncError, refresh };
}
