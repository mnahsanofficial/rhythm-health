# 14. A text budget, enforced by a test

**Status:** Accepted. **Date:** 5 Nov 2026. **Decided by:** Nazmul, from Maham's feedback ([07-feedback-5-nov](../design/07-feedback-5-nov.md)).

## Context

Maham's main point was "cognitive overload". We had cut words once already on 4 Nov (R-C in [04-synthesis](../design/04-synthesis.md)), and the reviewer still found too much text a day later. The Lab Report had 371 words. Grey text was another part of it: \`muted\` passes AA in both modes, yet 42–58% of the words on four screens were grey. An audit alone doesn't catch either.

## Decision

Each main-flow screen has a word budget, in \`apps/mobile/__tests__/word-budget.test.tsx\`. The test renders each screen with fixture data and fails if its visible words go over budget. It also fails if grey text is body-sized or longer than 8 words. The \`muted\` style is now caption-sized, so grey can't be used for a paragraph by accident. The rules are in [05-design-system](../design/05-design-system.md#text-budget).

## Alternatives

- **A review checklist.** It costs nothing, and it's what didn't hold after 4 Nov.
- **A darker \`muted\` token.** The token passes AA, the complaint was about how much of the text is grey, and web shares the token.
- **Screenshot tests.** They'd catch more, but they're brittle, and a person still has to judge each change.

## Consequences

- Raising a budget is a visible design decision in a diff.
- The counts use fixtures, so a long AI question or habit can still fill a real screen. The test guards our copy, not what the AI writes.
- It counts words only. It doesn't check layout, sheets or whether the words are clear.
- Text behind a tap isn't budgeted, apart from a test on How we know.
