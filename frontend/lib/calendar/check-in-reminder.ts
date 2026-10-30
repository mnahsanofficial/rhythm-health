// A calendar event (RFC 5545 .ics) for when the next check-in opens. Built in the browser, so a
// reminder needs no account integration or backend. It names the day only: calendars are often
// shared, so the habit question stays out of it.

const EVENT_MINUTES = 15;
const MAX_LINE_OCTETS = 75;

type Reminder = {
  experimentId: string;
  /** The day the event is for: the next one. */
  day: number;
  totalDays: number;
  /** When that day opens (the rolling 24-hour day boundary). */
  opens: Date;
  /** Absolute link back to the check-in. */
  url: string;
  now?: Date;
};

/** 2026-10-30T08:00:00.000Z → 20261030T080000Z */
function utc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** TEXT values escape backslashes, commas, semicolons and newlines. */
function text(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 octets continue on the next line after a single space. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = parts.length === 0 ? MAX_LINE_OCTETS : MAX_LINE_OCTETS - 1;
    if (size + bytes > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function checkInReminder({ experimentId, day, totalDays, opens, url, now = new Date() }: Reminder) {
  const ends = new Date(opens.getTime() + EVENT_MINUTES * 60 * 1000);
  const summary = `Rhythm check-in: day ${day} of ${totalDays}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rhythm Health Lab//Check-in reminder//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:rhythm-${experimentId}-day-${day}@rhythm`,
    `DTSTAMP:${utc(now)}`,
    `DTSTART:${utc(opens)}`,
    `DTEND:${utc(ends)}`,
    `SUMMARY:${text(summary)}`,
    `DESCRIPTION:${text(`Day ${day} is open. The check-in takes about 30 seconds: ${url}`)}`,
    `URL:${url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${text(summary)}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return {
    ics: lines.map(fold).join("\r\n") + "\r\n",
    fileName: `rhythm-day-${day}.ics`,
  };
}
