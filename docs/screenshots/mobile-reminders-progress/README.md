# Mobile reminders / Progress evidence

Expo web preview, 31 Oct 2026, at 390px, 768px and 1440px. All auth/API requests are intercepted; accounts, experiment days and answers are fixtures. No backend write or paid call.

- `today`: main navigation and daily action.
- `progress`: server-owned counts, state-labelled rows and the latest recorded day's answers.
- `recorded-day`: selecting a recorded row opens answers immediately beneath it.
- `day-states`: symbols and text distinguish recorded/missed/current/future without colour alone.
- `settings-web`: Settings layout. Native notifications are intentionally unavailable in web preview; permission/delivery/cancellation need the iPhone check.

Self-critique: moved the answers from a separate panel above the timeline into the selected row, where the person taps, and removed the repeated read-only paragraph. No decorative animation or second progress meter: numbers and recorded markers are immediate, including with reduced motion. Text scales normally and controls have minimum targets; physical large-text/VoiceOver and Android remain additional device coverage.

The production iOS and Android export labels were checked: the ten-second test button is absent. Native unit tests mock notification permissions, schedules, taps, preference storage and API reads/writes. Nazmul reported all physical iPhone checks passed: the reminder opens today's Check-in, Progress shows real days/answers, turning reminders off cancels the test, and cold-start tapping works. The phone uses his own real data. No signed-out tap, physical large-text/VoiceOver or Android check is claimed.
