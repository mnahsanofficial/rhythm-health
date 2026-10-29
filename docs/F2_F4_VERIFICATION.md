# F2/F4 verification — 30 Oct 2026

Base: `origin/main` at `137befa`, including backend [PR #24](https://github.com/mnahsanofficial/rhythm-health/pull/24) and follow-up [PR #25](https://github.com/mnahsanofficial/rhythm-health/pull/25). Frontend branch: `test/f2-f4-verification`.

## Real signed-in demo (F2 / B1)

Checked `/demo` → prepared report → history at **390px and 1440px**, using the user's existing browser session and the local backend on port 8001.

- Two `POST /api/demo/reset` requests returned the same seeded report (`6c4d3e0b…`). History still contained exactly one completed sample after the second reset.
- The report contains ten seeded chart days, the fixed seeded narrative, the prediction/result comparison and selectable day details. No narrative generation was needed.
- The real active experiment (`8a89e4fb…`) remained on day 1, with its original one recorded check-in after both resets. No check-ins were added or changed.
- A missing sample label on the report itself was found and fixed. The seeded report now explicitly says **Sample experiment** and explains its example check-ins. The real report was reloaded to verify the label.
- Real writes in this pass: **two intended demo resets only**. Paid proposal calls: **0**. Paid narrative calls: **0**. Real completion calls: **0**.

| Screen | 390px | 1440px |
|---|---|---|
| Demo entry | [Screenshot](screenshots/f2-f4-verification/real/demo-entry-390.jpg) | [Screenshot](screenshots/f2-f4-verification/real/demo-entry-1440.jpg) |
| Seeded report | [Screenshot](screenshots/f2-f4-verification/real/demo-report-390.jpg) | [Screenshot](screenshots/f2-f4-verification/real/demo-report-1440.jpg) |
| History | [Screenshot](screenshots/f2-f4-verification/real/demo-history-390.jpg) | [Screenshot](screenshots/f2-f4-verification/real/demo-history-1440.jpg) |

## Isolated early completion (F4 / B4)

**Live-check limitation:** the user's real account had no genuine early-finished report and its active experiment was only on day 1. The user explicitly chose isolated backend data. No fake health records were put in the shared Supabase project, and the real experiment was not completed. This is not a live end-to-end `/complete` verification.

`frontend/tests/support/generate_early_finish_reports.py` calls the merged backend's actual `analyze`, `with_progress` and `build_lab_report` functions with synthetic in-memory rows. It imports no database, auth, settings or AI client. The generated JSON is validated against the existing FastAPI OpenAPI schemas in the contract suite. Regeneration also asserts the expected coverage and missed-day lists.

The rule remains rolling **24-hour periods from `started_at`**, regardless of the viewer's timezone. Considered days are finished periods plus any logged day. Unlogged unfinished/future days neither count as missed nor reduce coverage. The viewer's timezone affects the displayed completion date only.

Fixed start: **2026-10-26 05:30 UTC**. Every completed case has a genuinely missed baseline day 2.

| Case | Expected missing days | Coverage | Key assertion |
|---|---|---|---|
| First day, active | None | 0 | Today is day 1; future days remain upcoming. A first-day completion is ineligible, so no impossible completed report is invented |
| Local date boundary, Nov 1 03:30 UTC | 2 | 5/6 | Completion displays Nov 1 in Dhaka and Oct 31 in Toronto; missing days stay identical |
| Day 7 in progress, unlogged | 2 | 5/6 | Days 7–10 are not missed |
| Day 7 in progress, logged | 2 | 6/7 | The logged current day contributes to coverage |
| Before Toronto fall-back, Nov 1 05:59:59 UTC | 2 | 5/6 | Repeated local hour does not alter rolling days |
| After fall-back, Nov 1 06:00 UTC | 2 | 5/6 | Same missed list across DST |
| Next 24-hour boundary | 2, 7 | 5/7 | Day 7 becomes missed only once its full interval has ended |
| Last day begins, unlogged | 2 | 8/9 | Day 10 is not missed yet |
| Last day ends, logged | 2 | 9/10 | Full-duration report retains the genuine missed day |

Playwright checks every case in **Asia/Dhaka** and **America/Toronto**, at **390px and 1440px**, with a fixed clock, mocked auth and intercepted API responses. It checks both the report chart and completed experiment timeline. No fixed sleeps or live services are used.

By hand, the day-7-unlogged report and experiment detail were also inspected at both widths through a separate local in-memory API on port 8002. Day 2 remains missed; days 7–10 are unfilled. Recorded-day buttons reveal the saved example values. No horizontal overflow or browser warning/error logs were observed.

| Screen | 390px | 1440px |
|---|---|---|
| Isolated early-finish report | [Screenshot](screenshots/f2-f4-verification/isolated/manual-report-390.jpg) | [Screenshot](screenshots/f2-f4-verification/isolated/manual-report-1440.jpg) |
| Isolated completed timeline | [Screenshot](screenshots/f2-f4-verification/isolated/manual-timeline-390.jpg) | [Screenshot](screenshots/f2-f4-verification/isolated/manual-timeline-1440.jpg) |
| Dhaka browser test | [Screenshot](screenshots/f2-f4-verification/isolated/Asia-Dhaka-390-timeline.png) | [Screenshot](screenshots/f2-f4-verification/isolated/Asia-Dhaka-1440-timeline.png) |
| Toronto browser test | [Screenshot](screenshots/f2-f4-verification/isolated/America-Toronto-390-timeline.png) | [Screenshot](screenshots/f2-f4-verification/isolated/America-Toronto-1440-timeline.png) |

## Regressions found and fixed test-first

1. The seeded report lacked its own sample notice. A user-facing component test failed because the **Sample experiment** note was absent, then passed after adding it. The demo browser test now checks it too.
2. The completed experiment detail independently marked every unlogged planned day missed. The new timeline tests initially produced **3 failed, 1 passed**, including day 7 labelled `missed` instead of `not recorded before completion`. The detail now loads the stored report's `analysis.adherence.missing_days`. A missing report has a visible unavailable state; a failed request has retry. Active experiments still use live progress and do not fetch a completed report.

The frontend does not recompute dates, filter the backend list, or rewrite stored analysis. Older reports computed before B4 may retain their old values; this work does not backfill them. `chart.points[].missed` remains B11/F13, waiting on Shakeb; the frontend does not pretend that field exists yet.

## Repeat the checks

From the repository root, after setting up backend dependencies:

```bash
backend/.venv/bin/python frontend/tests/support/generate_early_finish_reports.py \
  > frontend/tests/support/early-finish-reports.json
cd frontend
npm run lint
npm run typecheck
npm test
CAPTURE_F2_F4=1 npm run test:e2e -- \
  tests/e2e/early-finish-days.spec.ts tests/e2e/seeded-demo.spec.ts
npm run test:e2e
```

For optional manual isolated inspection, run from the root:

```bash
backend/.venv/bin/python frontend/tests/support/f4_isolated_api.py
```

In a second terminal, with no Playwright suite using the same output directory:

```bash
cd frontend
NEXT_PUBLIC_API_URL=http://127.0.0.1:8002 \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:8002 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=fake-isolated-anon-key \
NEXT_DIST_DIR=.next-playwright \
npm run dev -- --hostname 127.0.0.1 --port 3101
```

Open `http://localhost:3101/sign-in`. Any clearly fake email/password works against this local stub only; it never forwards them anywhere. Open `/experiments/4d331bf2-5522-5edf-87f8-f374c8a71a83/report` for the day-7-unlogged case. The isolated API rejects every product write, including proposal, completion and narrative generation. It stores nothing and makes no outbound requests. Stop both isolated processes afterwards.

## Final checks

- ESLint and TypeScript: passed.
- Vitest: **121 passed** across 21 files.
- Backend pytest: **218 passed**, one existing Starlette/httpx deprecation warning.
- Production build: passed; all 12 pages generated using fake public test settings.
- Full Playwright suite: **70 passed, 1 existing skip** (6.2 minutes). A final focused rerun after conforming fake check-in IDs to UUIDs also passed all **4 F4 cases** (53.7 seconds).
- Existing keyboard-onboarding skip remains outside this work; no new skips were added.
