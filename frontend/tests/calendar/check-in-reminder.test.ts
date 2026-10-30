import { describe, expect, it } from "vitest";
import { checkInReminder } from "@/lib/calendar/check-in-reminder";

const reminder = () => checkInReminder({
  experimentId: "33333333-3333-3333-3333-333333333333",
  day: 5,
  totalDays: 10,
  opens: new Date("2026-10-30T08:00:00Z"),
  url: "http://localhost:3000/experiments/33333333-3333-3333-3333-333333333333/check-in",
  now: new Date("2026-10-29T21:15:00Z"),
});

describe("check-in reminder calendar file", () => {
  it("is a standard calendar event that starts when the day opens, in UTC", () => {
    const { ics } = reminder();
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
    expect(ics).toContain("\r\nDTSTART:20261030T080000Z\r\n");
    expect(ics).toContain("\r\nDTEND:20261030T081500Z\r\n");
    expect(ics).toContain("\r\nDTSTAMP:20261029T211500Z\r\n");
  });

  it("names the day plainly, links back to the check-in and alerts when it opens", () => {
    const ics = reminder().ics.replace(/\r\n /g, ""); // undo line folding
    expect(ics).toContain("\r\nSUMMARY:Rhythm check-in: day 5 of 10\r\n");
    expect(ics).toContain("\r\nURL:http://localhost:3000/experiments/33333333-3333-3333-3333-333333333333/check-in\r\n");
    expect(ics).toMatch(/BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:[^\r]+\r\nTRIGGER:PT0M\r\nEND:VALARM/);
  });

  it("keeps the habit question out of the event, because calendars are often shared", () => {
    expect(reminder().ics).not.toMatch(/walk|dinner|energy/i);
  });

  it("uses a stable id per experiment and day, so adding it twice updates one event", () => {
    expect(reminder().ics).toContain("\r\nUID:rhythm-33333333-3333-3333-3333-333333333333-day-5@rhythm\r\n");
    expect(reminder().fileName).toBe("rhythm-day-5.ics");
  });

  it("escapes text and folds long lines as the calendar format requires", () => {
    const { ics } = checkInReminder({
      experimentId: "x", day: 2, totalDays: 10, opens: new Date("2026-10-30T08:00:00Z"),
      url: `https://example.invalid/${"a".repeat(120)}?q=1,2;3`, now: new Date("2026-10-29T21:15:00Z"),
    });
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    const unfolded = ics.replace(/\r\n /g, "");
    // Text fields escape commas and semicolons; the URL value is a URI and stays as is.
    expect(unfolded).toContain(String.raw`?q=1\,2\;3`);
    expect(unfolded).toContain("\r\nURL:https://example.invalid/");
    expect(unfolded).toMatch(/\r\nURL:[^\r]*\?q=1,2;3\r\n/);
  });
});
