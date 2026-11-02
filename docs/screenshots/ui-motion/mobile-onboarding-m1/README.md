# M1 rhythm reveal

2 Nov 2026, isolated fake-config Expo web export. [Full walkthrough and limitations](../../mobile-signup-onboarding/README.md).

Each width has before/during/after frames. At 390px the ring uses the shared 480ms opacity reveal, captured 120ms into the transition and after completion with a controlled browser clock. At 1440px reduced motion shows the final ring immediately. Text and controls do not wait for motion. No health number is animated, and no paid or shared-database request is made in this walkthrough.

These frames verify the browser presentation, not native UIKit/Android picker rendering. The phone's system time picker is covered by native behavior tests and iOS/Android exports; Nazmul approved opening the PR after requesting that addition to the otherwise accepted M1 flow.
