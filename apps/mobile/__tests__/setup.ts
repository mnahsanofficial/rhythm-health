// Fake configuration only; never load .env.local in automated tests.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://supabase.test.invalid';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'fake-public-anon-key';
process.env.EXPO_PUBLIC_API_URL = 'http://api.test.invalid:8001';

jest.mock('expo-notifications', () => require('./support/notifications').notifications);
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => require('./support/notifications').preferences.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => { require('./support/notifications').preferences.set(key, value); }),
  deleteItemAsync: jest.fn(async (key: string) => { require('./support/notifications').preferences.delete(key); }),
}));
beforeEach(() => require('./support/notifications').resetNotifications());
