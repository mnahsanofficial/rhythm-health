import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { readConfig } from './config';
import { createSecureSessionStorage } from './secure-session-storage';

export function createAuthClient(config: Pick<ReturnType<typeof readConfig>, 'supabaseUrl' | 'anonKey'>) {
  // Expo web is a preview only: never fall back to plaintext persistent storage.
  const preview = new Map<string, string>();
  const storage = Platform.OS === 'web' ? {
    getItem: async (key: string) => preview.get(key) ?? null,
    setItem: async (key: string, value: string) => { preview.set(key, value); },
    removeItem: async (key: string) => { preview.delete(key); },
  } : createSecureSessionStorage(SecureStore);
  return createClient(config.supabaseUrl, config.anonKey, {
    auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });
}
