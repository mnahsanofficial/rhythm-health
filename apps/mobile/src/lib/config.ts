export function readConfig() {
  // Expo replaces dot-notation EXPO_PUBLIC references at bundle time.
  const values = {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim(),
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim(),
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL?.trim(),
  };
  for (const [name, value] of Object.entries(values)) {
    if (!value) throw new Error(`Set ${name} in apps/mobile/.env.local, then restart Expo.`);
  }
  const supabaseUrl = values.EXPO_PUBLIC_SUPABASE_URL!;
  const apiUrl = values.EXPO_PUBLIC_API_URL!.replace(/\/+$/, '');
  for (const [name, value] of [['EXPO_PUBLIC_SUPABASE_URL', supabaseUrl], ['EXPO_PUBLIC_API_URL', apiUrl]]) {
    try {
      if (!['http:', 'https:'].includes(new URL(value).protocol)) throw new Error();
    } catch { throw new Error(`Check ${name}: it must be an HTTP or HTTPS URL.`); }
  }
  // V1 is local-only. The web runs on the same Mac as the API, at port 3000.
  const web = new URL(apiUrl); web.port = '3000'; web.pathname = '/'; web.search = ''; web.hash = '';
  return { supabaseUrl, anonKey: values.EXPO_PUBLIC_SUPABASE_ANON_KEY!, apiUrl, webUrl: web.toString() };
}
