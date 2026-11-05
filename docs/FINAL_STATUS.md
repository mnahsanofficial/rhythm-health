# Final status

For 8x reviewers. Updated 5 Nov 2026 Asia/Dhaka. Changes close at 18:00 on 6 Nov.

**Rhythm Health Lab** turns a habit question into a 10-day personal experiment: a prediction first, a short daily check-in, then a Lab Report comparing the two. The phone app is the product.

## Done

- **The full mobile flow:** sign-up, onboarding, Ask, your guess, the plan, daily check-ins, reminders, Lab Report, the Day 10 choice, Progress and History. Up to 3 experiments at once. ([README](../README.md))
- **Maham's 5 Nov feedback:** one question per screen, state shown as icons, word budgets enforced by a test, grey for captions only, and an answer to "how do we know it helped?". ([what changed](design/07-feedback-5-nov.md), [tracker](FEEDBACK_TRACKER.md#5-nov-demo-call-maham))
- **A check-in question fills the phone:** a scene that reacts to your answer in the middle, and the answers at the bottom, within reach of the thumb. Decorative only, and it adds no words. ([motion rule](rules/ui-motion.md))
- **Honest results:** Python measures, the AI only writes it up, and samples are flagged and never counted. ([ADR 3](adr/0003-ai-proposes-python-measures.md), [ADR 5](adr/0005-samples-flagged-never-counted.md))
- **Process:** every session logged, every PR merge-committed, and CI on lint, types, tests, migrations and secrets. ([logging](logging.md), [5 Nov log audit](logging.md#audit-of-5-nov-2026))

## Not done

- **The web app doesn't have the 5 Nov changes.** It keeps the old text-heavy screens; mobile is the product ([why](ARCHITECTURE.md#8-deliberate-web-and-mobile-differences)).
- **No outside user has tested it.** Every usability finding comes from Nazmul on an iPhone or from Maham watching a demo, so we don't know yet whether first-time users find it easier.
- **We can't say a change helps anyone.** The app shows whether something moved beyond your normal ups and downs in 10 days: a pattern, not proof.
- **Word budgets guard our copy, not AI text.** A long AI question can still fill a real screen.
- **Post-demo backlog:** editing a plan before starting, mobile error reporting, the two-week follow-up. ([REMAINING_WORK](REMAINING_WORK.md#after-the-demo))

## How the 5 Nov PRs were checked

Unit tests, lint, types and CI, plus Expo web screenshots in light and dark with every call mocked. **Real iPhone, VoiceOver and Reduce Motion checks are in Nazmul's pass on the morning of 6 Nov,** after the merges. Anything broken gets a follow-up fix.

## How the 6 Nov short-labels PRs were checked

Unit tests, lint, types and CI, plus Expo web screenshots in light and dark with every call mocked, and an iOS bundle build. No paid call was made. **Not checked:** a real iPhone, VoiceOver and Reduce Motion on a device, and the new prompt against the real model.

## What's next

1. The iPhone pass, and any fixes from it, by 18:00 on 6 Nov.
2. The hallway test with someone who isn't us ([plan](design/01-user-research.md)).
3. If the app continues, the same budgets and flow on web.
