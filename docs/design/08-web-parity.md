# Web parity, designed for desktop

6 Nov 2026. Work is delivered as separate feature PRs; a checked implementation is not a merged feature. The review cutoff for this work is 16:00 Asia/Dhaka. Anything not green then belongs in FINAL_STATUS as “after the demo”.

## Today dashboard

The web keeps useful context beside the next decision. At 1024px and above, the left column holds the greeting, due card and Up next; the right holds the weekly ring and other experiments. On phones the next action comes first, then the supporting context.

| Feature | Before | This change |
|---|---|---|
| Heading | Full AI question | Greeting, then the saved short experiment name |
| Next action | Repeated for each running experiment | One primary action; combined check-in when supplied by the API |
| Several experiments | Repeated full summaries | Soonest due real experiment first; compact Also running cards |
| Weekly context | None | One experiment's recorded days in its rolling seven days, clearly named |
| Timeline | Full daily-answer viewer on Today | Compact strip for each experiment; full observations remain on its detail page |
| Long content | Full change and question on the page | Short change; full question and instructions in Details |
| Final recorded day | Separate finish action on detail | Today links to finishing even when earlier days were missed |
| Samples | Labelled sample and removable | Labels and removal preserved; samples never displace real due work |
| New question in place | Remains mounted while hidden | Preserved, including answers, pending requests and focus return |

The ring and strips use server progress, not locally calculated dates. The weekly ring is not a total across overlapping experiments. A sample's weekly count is labelled Example. Missing short names use “Your experiment”; the original question remains available in Details.

The scene is intentionally small beside the summary on desktop. The first visual review found that a full-width scene pushed Up next below the viewport; the smaller scene leaves room for the action and context. Only opacity and transform animate. Health values never count through intermediate numbers, and reduced motion shows the final scene and ring immediately.

## Screenshot evidence

All data and authentication are mocked. No shared database writes or paid AI calls were used.

| Width | Light | Dark |
|---|---|---|
| 1440 | [Several experiments](../screenshots/web-parity/today/manual-1440-light.png) | [Several experiments](../screenshots/web-parity/today/manual-1440-dark.png) |
| 1024 | [Several experiments](../screenshots/web-parity/today/manual-1024-light.png) | [Several experiments](../screenshots/web-parity/today/manual-1024-dark.png) |
| 390 | [Several experiments](../screenshots/web-parity/today/manual-390-light.png) | [Several experiments](../screenshots/web-parity/today/manual-390-dark.png) |

The [previous desktop layout](https://github.com/mnahsanofficial/rhythm-health/blob/9d03ad7/docs/screenshots/several-active/your-lab-1440.png) and [previous phone layout](https://github.com/mnahsanofficial/rhythm-health/blob/9d03ad7/docs/screenshots/several-active/your-lab-390.png) are retained from main. New due, recorded, error and motion frames live in [the Today evidence folder](../screenshots/web-parity/today/).

## Remaining approved work

The four-step plan is merged (#116). Report hierarchy; Day 3 and Day 10 moments; a dedicated Progress page; and the remote-worker landing page are after the demo. Current statuses and the stop request are recorded in FINAL_STATUS.

## Stepped check-in

The single and combined check-ins now share one question engine. At 1024px and above, the question and answers sit beside a neutral reacting scene. On phones the scene comes before the answer controls, with Back and Next in a bottom action bar. Review lists every answer with an edit action and an optional note disclosure.

| Feature | Before | This change |
|---|---|---|
| Daily questions | All questions in one long form | One question per step, short heading, full question beneath |
| Advancement | Save after the full form | First selection advances after a short response; typed, revisited and edit answers require Next |
| Keyboard | Native controls | Native controls plus 1–9 and Enter; arrow-key selection waits for Next |
| Review | No dedicated review | Answer summary, direct edit and return to review |
| Save feedback | Brief confirmation | Neutral ring and saved day, refreshed server progress, edit or Continue |
| Several experiments | Combined form | Same steps; shared questions remain deduplicated by the API |
| Errors | Form error | Answers retained on retry; stale combined revision reload retained; changed day blocks a single save |

Step entrances use a short vertical transform: horizontal movement briefly pushed the phone’s full-width action bar past the viewport, which the full width suite caught. Back cancels pending advancement. Empty answers cannot advance or save; zero and false remain valid. Number and duration fields keep partial text without treating digits as shortcuts. Large scales use typed input with accessible bounds. No result or prediction counts through intermediate values.

The browser celebration deliberately waits for Continue rather than dismissing after a timer. This gives keyboard and screen-reader users time to read it and change their answers. Its day comes from the save receipt; its ring and days-left message come from refreshed server progress. Failed progress refresh never turns a successful save into an invented count.

All requests used for automated and manual verification were mocked, with no paid AI calls or shared database writes. Mobile, backend and shared packages are unchanged.

| Width | Light question | Dark question | Light review | Dark review |
|---|---|---|---|---|
| 1440 | [Question](../screenshots/web-parity/checkin/1440-light-question.png) | [Question](../screenshots/web-parity/checkin/1440-dark-question.png) | [Review](../screenshots/web-parity/checkin/1440-light-review.png) | [Review](../screenshots/web-parity/checkin/1440-dark-review.png) |
| 1024 | [Question](../screenshots/web-parity/checkin/1024-light-question.png) | [Question](../screenshots/web-parity/checkin/1024-dark-question.png) | [Review](../screenshots/web-parity/checkin/1024-light-review.png) | [Review](../screenshots/web-parity/checkin/1024-dark-review.png) |
| 390 | [Question](../screenshots/web-parity/checkin/390-light-question.png) | [Question](../screenshots/web-parity/checkin/390-dark-question.png) | [Review](../screenshots/web-parity/checkin/390-light-review.png) | [Review](../screenshots/web-parity/checkin/390-dark-review.png) |

The [check-in evidence folder](../screenshots/web-parity/checkin/) also contains saved, retry, edit and before/during/after motion states. Reduced-motion checks verify that the final scene is static.

## Four-step plan and planning wait

The plan now separates four decisions: understand the change, make a personal guess, reveal the forecast, then review the days and Start. At 1024px and above, short content sits beside the scene or comparison. On phones the live guess bar stays directly beneath the input, ahead of its action, so it remains useful while typing.

| Feature | Before | This change |
|---|---|---|
| First plan screen | Guess immediately, or full proposal and forecast | Saved short change; full action, question, hypothesis and timing in Details |
| Personal guess | Text field | Validated text field plus a live bar; negative, zero and positive values remain explicit |
| Reveal | Forecast card | Guess marked on the same scale as the predicted range, including guesses outside it |
| Long forecast content | Visible reasoning and uncertainty list | Short result and confidence caption; reasoning in Why this range |
| Before starting | Start under a full proposal | Separate planned-day ring and numbered normal/test days, recorded measures in Details |
| Planning wait | Placeholder blocks | Ring illustration and three simultaneous activities, never invented completion stages |

The first guess locks on reveal; going Back cannot expose an editable guess afterward. If the server says guesses are unavailable, the flow skips that step and explains it without inventing a value. The save/start lock, saved experiment ID, retry behavior, active limit handling and explicit consent to omit an unavailable guess remain in the existing data flow.

The day ring describes the proposed plan, not recorded observations. The waiting scene is decorative: one request returns safety, plan and forecast together, so its three activities remain “in progress” until that request finishes. Only the pending dots pulse; reduced motion shows a static scene. Step entrances use opacity and a short vertical transform. Forecast and guess numbers never count through intermediate values.

Manual review used fake authentication and mocked API routes at 390px and 1440px. It covered Details, negative guess feedback, Enter to reveal, the desktop comparison, a failed save retaining the locked guess and days, then retrying successfully. No real accounts, shared database writes or paid AI calls were used. Mobile, backend and shared packages are unchanged.

| Width | Light change | Dark guess | Light reveal | Dark days |
|---|---|---|---|---|
| 1440 | [Change](../screenshots/web-parity/plan/1440-light-change.png) | [Guess](../screenshots/web-parity/plan/1440-dark-guess.png) | [Reveal](../screenshots/web-parity/plan/1440-light-reveal.png) | [Days](../screenshots/web-parity/plan/1440-dark-days.png) |
| 1024 | [Change](../screenshots/web-parity/plan/1024-light-change.png) | [Guess](../screenshots/web-parity/plan/1024-dark-guess.png) | [Reveal](../screenshots/web-parity/plan/1024-light-reveal.png) | [Days](../screenshots/web-parity/plan/1024-dark-days.png) |
| 390 | [Change](../screenshots/web-parity/plan/390-light-change.png) | [Guess](../screenshots/web-parity/plan/390-dark-guess.png) | [Reveal](../screenshots/web-parity/plan/390-light-reveal.png) | [Days](../screenshots/web-parity/plan/390-dark-days.png) |

The [plan evidence folder](../screenshots/web-parity/plan/) contains all four steps in both themes, plus before/during/after frames of the planning wait. The [stepped check-in PR](https://github.com/mnahsanofficial/rhythm-health/pull/115) has merged.

## Full habit and safety question choices

The complete server message is body text beneath a short result heading. Desktop places the explanation beside the suggested question and actions. Phone web stacks them. Extra context about small habits is available in a disclosure, and unrelated starter chips disappear while the person is deciding.

| Feature | Before | This change |
|---|---|---|
| Soft check | Full message styled as a title, two secondary buttons | Short heading, complete body message, one primary suggestion and a separate Continue choice |
| Repeated submission | Original Design button remains available | Hidden while the soft check is open; editing or using the suggestion restores it |
| Suggested question | Text and a button | Clearly labelled suggestion with an explanation that it fills the real editable field |
| Safety reason | Muted body beneath an unstructured title | Full-contrast reason beneath a focused semantic heading |
| Advice-only safety response | Read as advice | Preserved as advice; never used as an invented question |
| Focus | Result container | Result heading; back to the actual question input after prefilling |
| Question entry | Muted lead and mono eyebrow | Full-contrast body; mono reserved for the character count |

Using a suggestion makes no request. It only fills and focuses the question field. Continue anyway preserves the original question and explicitly sends the existing continuation flag. Safety blocks never offer that bypass; the blocked question must be edited or replaced with the server’s suggested question. No backend or shared-package change is needed.

Manual review used fake authentication and API routes at 390px and 1440px. The full soft-check message, heading focus, soft suggestion, safety reason, and safety suggestion prefilling were checked with native controls. The returned question remained editable and focused. Browser console had no JavaScript errors. No paid AI calls, real sign-ups or shared database writes were used.

| Width | Light soft check | Dark soft check | Light safety | Dark safety |
|---|---|---|---|---|
| 1440 | [Soft check](../screenshots/web-parity/question/1440-light-soft-check.png) | [Soft check](../screenshots/web-parity/question/1440-dark-soft-check.png) | [Safety](../screenshots/web-parity/question/1440-light-safety.png) | [Safety](../screenshots/web-parity/question/1440-dark-safety.png) |
| 1024 | [Soft check](../screenshots/web-parity/question/1024-light-soft-check.png) | [Soft check](../screenshots/web-parity/question/1024-dark-soft-check.png) | [Safety](../screenshots/web-parity/question/1024-light-safety.png) | [Safety](../screenshots/web-parity/question/1024-dark-safety.png) |
| 390 | [Soft check](../screenshots/web-parity/question/390-light-soft-check.png) | [Soft check](../screenshots/web-parity/question/390-dark-soft-check.png) | [Safety](../screenshots/web-parity/question/390-light-safety.png) | [Safety](../screenshots/web-parity/question/390-dark-safety.png) |

## Wrap-up scope

Nazmul requested that the current work be finished, the latest log pushed, and work stopped before the 16:00 cutoff. Today, check-in, the plan (#116) and question choices (#117) are merged. The remaining report, outcome, Progress and landing parity is recorded as after the demo in [FINAL_STATUS](../FINAL_STATUS.md#web-parity-handover--6-nov). The desktop direction is documented in [ADR 15](../adr/0015-content-rich-web-focused-mobile.md).
