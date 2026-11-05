# 13. One question per screen in the check-in

**Status:** Accepted. **Date:** 5 Nov 2026. **Decided by:** Nazmul, from Maham's feedback ([07-feedback-5-nov](../design/07-feedback-5-nov.md)).

## Context

The check-in was one form: a test day with 2 measures showed 3 required questions and a note, 55 words in all. Maham: "The today check-in screen is asking you so many questions on one screen." The check-in is the daily loop, so it's the screen people see most.

## Decision

Each question gets its own screen, with a large heading, large answers, progress dots and Back. A tap answers and moves on; a typed number waits for Next. The last step is a review of icons and values, with the note behind "Add a note ›", then Save. Editing is the same flow, prefilled. The combined check-in goes experiment by experiment, and a question two experiments share appears once and says so. All of this lives in one component, \`CheckinFlow\`, and the API is unchanged.

## Alternatives

- **Keep one screen, with fewer words.** It would cut the reading, but not the decisions on one screen, which was her point.
- **A swipeable carousel.** It's what she described, but a swipe adds a gesture to learn and hides the way back. Tapping an answer does the same job.
- **Save after each answer.** The API saves a day's check-in as a whole, and partial days would make the analysis harder.

## Consequences

- More taps: a test day with 2 measures takes 4 instead of 4 plus scrolling, and typed numbers need Next as well. **Whether it stays quick by day 7 is unproven.**
- Android's back button leaves the flow, with the "won't be kept" prompt, rather than stepping back.
- Mobile only. The web check-in is still one form.
