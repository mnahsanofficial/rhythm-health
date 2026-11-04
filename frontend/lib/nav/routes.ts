/** Flows are screens people enter and leave. Each closes to where they came from, or here if they opened it directly. */
export function flowFallback(path: string): string | null {
  if (path === "/sign-in" || path === "/onboarding" || path === "/experiments/new" || path === "/check-in") return "/";
  const checkIn = /^(\/experiments\/[^/]+)\/check-in$/.exec(path);
  return checkIn ? checkIn[1] : null;
}

const SECTIONS: Record<string, string> = { "/": "Your lab", "/history": "History", "/demo": "Demo" };

/** The main section at this path, for a back link that names where it goes. */
export function sectionOf(path: string | null): { href: string; label: string } | null {
  return path && SECTIONS[path] ? { href: path, label: SECTIONS[path] } : null;
}

/** What each flow says it would lose, under "Leave without saving?". */
export const WONT_BE_KEPT = {
  question: "Your question won't be kept.",
  proposal: "Your proposal won't be kept.",
  answers: "Your answers won't be kept.",
} as const;
