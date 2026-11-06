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

The four-step plan and planning wait; soft-check and safety presentation; report hierarchy; Day 3 and Day 10 moments; a dedicated Progress page; the remote-worker landing page. Their parity tables and evidence will be added with their implementations. The final documentation pass will reconcile the tracker, final status, README, changelog, architecture and the desktop/mobile ADR.

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
