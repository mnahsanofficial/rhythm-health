# Calm Today — Expo web evidence

Captured 5 November 2026 at 390×844, with every external request intercepted. All pictured health data is an **Example**, identified by the screenshot badge. Auth and API replies are fake. No account, database or paid AI service was contacted.

| State | Light | Dark |
| --- | --- | --- |
| One experiment due | [Light](due-light.png) | [Dark](due-dark.png) |
| Already checked in | [Light](recorded-light.png) | [Dark](recorded-dark.png) |
| Day 10, recorded | [Light](day10-light.png) | [Dark](day10-dark.png) |
| Three experiments | [Light](three-light.png) | [Dark](three-dark.png) |
| Nothing running | [Light](empty-light.png) | [Dark](empty-dark.png) |

[Reduced usable height and Reduce Motion](due-safe-area-reduced-motion.png) uses 390×763, reserving the equivalent of 81pt for an iPhone's top and bottom safe areas. Single-experiment and empty states have no scroll overflow at standard text size. [Large text](due-large-text-reduced-motion.png) doubles body text sizes and line heights (keeping the existing 1.3× native tab-label cap), checks horizontal overflow and scrolls the primary action into view. Large text can scroll vertically; it stays usable rather than shrinking text. This approximates layout in a browser, not native Dynamic Type.

[Baseline opening today](baseline-light.png) and [baseline opening tomorrow](baseline-tomorrow-light.png) also fit at 390×763. The label uses the returned opening, rather than assuming calendar midnight.

[Desktop light](due-desktop-light.png) and [desktop dark](due-desktop-dark.png) check 1440×900. Motion frames: [entrance](due-enter.png), [during](due-during.png), [settled](due-light.png), and [pressed](due-pressed.png).

The capture script also opens Check-in, edit, experiment detail, another running experiment, Ask and the free completion → Lab Report flow. All calls stay mocked. Reduced Motion is checked while holding the primary action: its width must stay unchanged. Normal press feedback, haptics, native SVG, VoiceOver and OS text scaling still need the iPhone checklist in the PR.

Reproduce from the repository root:

```sh
EXPO_NO_DOTENV=1 EXPO_PUBLIC_SUPABASE_URL=https://supabase.test.invalid EXPO_PUBLIC_SUPABASE_ANON_KEY=fake-public-anon-key EXPO_PUBLIC_API_URL=http://api.test.invalid:8001 npm exec --workspace=@rhythm-health/mobile -- expo export --platform web --output-dir /tmp/rhythm-calm-web
python3 -m http.server 8096 --bind 127.0.0.1 --directory /tmp/rhythm-calm-web
# In another terminal:
node apps/mobile/scripts/capture-calm-today.cjs
```

The script aborts any unexpected external request and fails on page errors or duplicate React keys. [Verification](verification.json) records the viewport and overflow checks. Browser evidence does not claim a physical iPhone test.
