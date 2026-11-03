// Fake configuration only; never load .env.local in automated tests.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://supabase.test.invalid';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'fake-public-anon-key';
process.env.EXPO_PUBLIC_API_URL = 'http://api.test.invalid:8001';

// Jest's hoisted factories must load this shared mutable driver at runtime.
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('expo-notifications', () => require('./support/notifications').notifications);
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => require('./support/notifications').preferences.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => { require('./support/notifications').preferences.set(key, value); }),
  deleteItemAsync: jest.fn(async (key: string) => { require('./support/notifications').preferences.delete(key); }),
}));
beforeEach(() => require('./support/notifications').resetNotifications());

// A duplicate React key can silently drop or duplicate a screen's content, so it fails the test.
const reportError = console.error;
const duplicateKeys: string[] = [];
console.error = (...args: unknown[]) => {
  if (String(args[0]).includes('two children with the same key')) duplicateKeys.push(String(args[1] ?? args[0]));
  reportError(...args);
};
afterEach(() => { expect(duplicateKeys.splice(0)).toEqual([]); });
