# Secrets

These logs are public. Anything a secret touches (a prompt, a response, a commit, a log) can end up on GitHub.

## Where they live

- Real values go in `frontend/.env.local`, `backend/.env.local` and `apps/mobile/.env.local` only. `.gitignore` ignores every `.env*` file except `.env.example`.
- `.env.example` files list variable **names**, never values. Update them when you add a variable.
- `frontend/.env.test` is committed on purpose. It holds fake placeholder values for the automated tests, never a real project's.
- The full list of variables, and which are secret, is in [`docs/ENV_SETUP.md`](../ENV_SETUP.md).

## Rules

- **Never print, echo, `cat` or paste a secret value**: not in a terminal, a response, a PR or a test.
- To check a variable, check it by **name** and say "set" or "not set".
- **Backend-only secrets never reach the browser**:
  - `SUPABASE_SERVICE_ROLE_KEY` and `OPENROUTER_API_KEY` are read only in `backend/app/config.py`.
  - Never give one a `NEXT_PUBLIC_` name, because Next.js ships every `NEXT_PUBLIC_` variable to the browser.
- The frontend only has the Supabase URL, the public anon key and the API URL (TRD §36).
- If a real value ends up in a commit or a session log, tell the other person straight away and rotate it in Supabase or OpenRouter. Deleting the commit isn't enough once it's pushed.

## Mobile

Expo bundles `EXPO_PUBLIC_…` settings into the app. Only `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_API_URL` belong in `apps/mobile/.env.local`. Never a service-role or OpenRouter key. Check set/not set by name only, never print values, and never commit the file. Native sessions use SecureStore; tests use fake configuration in test setup, never real env files.
