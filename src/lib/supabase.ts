import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Expo replaces these exact process.env references when bundling the app.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const supabaseConfigurationError = !url || !key
  ? 'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local, then restart Expo.'
  : !/^https?:\/\//.test(url) || key.startsWith('sb_secret_') || key.startsWith('eyJ')
    ? 'Use a valid Supabase project URL and its publishable key (sb_publishable_…) in .env.local.'
    : '';

// A missing configuration produces a recoverable startup screen, rather than a module crash.
export const supabase = supabaseConfigurationError ? null : createClient(url!, key!, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});
