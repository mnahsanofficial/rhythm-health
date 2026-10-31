// Fake configuration only; never load .env.local in automated tests.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://supabase.test.invalid';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'fake-public-anon-key';
process.env.EXPO_PUBLIC_API_URL = 'http://api.test.invalid:8001';
