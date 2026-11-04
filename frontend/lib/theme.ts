import { THEMES, type ThemeName } from "@rhythm-health/brand";

export type ThemeChoice = ThemeName | "system";

/** Kept per device, in this browser only. */
export const THEME_KEY = "rhythm-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Runs before first paint, so a dark page never flashes light. Keep its rules in step with `resolveTheme`. */
export const THEME_SCRIPT = `(function(){var t=null;try{t=localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}if(t!=="light"&&t!=="dark"){t=matchMedia(${JSON.stringify(DARK_QUERY)}).matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)})()`;

export function resolveTheme(choice: ThemeChoice): ThemeName {
  if (choice !== "system") return choice;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/** A choice the browser refused to store still holds until the page reloads. */
let unsaved: ThemeChoice | null = null;

export function readThemeChoice(): ThemeChoice {
  if (unsaved) return unsaved;
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

/** Returns false when the browser refuses to store it; the choice still applies to this page. */
export function saveThemeChoice(choice: ThemeChoice): boolean {
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
    unsaved = null;
    return true;
  } catch {
    unsaved = choice;
    return false;
  }
}

export function applyTheme(choice: ThemeChoice) {
  const theme = resolveTheme(choice);
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
    meta.setAttribute("content", THEMES[theme].background);
  });
}

export function watchSystemTheme(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
