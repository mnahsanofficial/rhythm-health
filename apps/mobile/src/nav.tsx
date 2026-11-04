import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { BackHandler, Modal, Pressable, StyleSheet, View } from 'react-native';
import { FONT_FAMILIES, LAYOUT, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import { Action, Copy, useStyles } from './ui';
import { themedStyles } from './theme-core';

/**
 * What the screen on show does when you leave it, from the header or Android's back button.
 * - flow: entered and left. The header shows a ×.
 * - detail: has its own back link at the top.
 * - section: a main section with no control on screen. Android's back button returns to Today.
 */
export type NavScreen = {
  kind: 'flow' | 'detail' | 'section';
  onBack: () => void;
  /** What leaving would lose, as a sentence for the sheet. Null when nothing would be. */
  unsaved?: string | null;
  /** Something is saving: ignore the × until it finishes. */
  busy?: boolean;
  /** Going home keeps this open and safe, so the logo doesn't need to ask. */
  safeAtHome?: boolean;
};

export const WONT_BE_KEPT = {
  question: "Your question won't be kept.",
  proposal: "Your proposal won't be kept.",
  answers: "Your answers won't be kept.",
  changes: "Your changes won't be kept.",
} as const;

type Registered = { id: string; screen: RefObject<NavScreen> };
type Nav = {
  register: (entry: Registered) => () => void;
  /** Whether the header shows the ×, and whether it can be used right now. */
  closable: boolean;
  closeBusy: boolean;
  close: () => void;
  goHome: (home: () => void) => void;
  refresh: () => void;
};
const NavContext = createContext<Nav>({ register: () => () => undefined, closable: false, closeBusy: false, close: () => undefined, goHome: home => home(), refresh: () => undefined });
export const useNav = () => useContext(NavContext);

/** Declares how this screen is left. Pass null when it isn't the one on show. */
export function useNavScreen(screen: NavScreen | null) {
  const { register, refresh } = useNav();
  const id = useId();
  const latest = useRef<NavScreen>({ kind: 'section', onBack: () => undefined });
  const active = screen !== null;
  // eslint-disable-next-line react-hooks/refs -- Only read from presses and effects, after this render commits.
  if (screen) latest.current = screen;
  useEffect(() => (active ? register({ id, screen: latest }) : undefined), [active, id, register]);
  // The header shows the × as disabled while saving; tell it when that changes.
  const shape = screen ? `${screen.kind}:${Boolean(screen.busy)}` : '';
  useEffect(() => { refresh(); }, [shape, refresh]);
}

export function NavProvider({ children }: { children: ReactNode }) {
  const stack = useRef<Registered[]>([]);
  const [top, setTop] = useState<Pick<NavScreen, 'kind' | 'busy'> | null>(null);
  const [asking, setAsking] = useState<{ reason: string; leave: () => void } | null>(null);
  const refresh = useCallback(() => {
    const screen = stack.current.at(-1)?.screen.current;
    setTop(screen ? { kind: screen.kind, busy: screen.busy } : null);
  }, []);
  const register = useCallback((entry: Registered) => {
    stack.current = [...stack.current, entry];
    refresh();
    return () => { stack.current = stack.current.filter(item => item !== entry); refresh(); };
  }, [refresh]);

  const leave = useCallback((screen: NavScreen, go: () => void) => {
    if (screen.unsaved) setAsking({ reason: screen.unsaved, leave: go });
    else go();
  }, []);
  const close = useCallback(() => {
    const screen = stack.current.at(-1)?.screen.current;
    if (screen && !screen.busy) leave(screen, screen.onBack);
  }, [leave]);
  const goHome = useCallback((home: () => void) => {
    const screen = stack.current.at(-1)?.screen.current;
    if (screen && !screen.safeAtHome) leave(screen, home);
    else home();
  }, [leave]);

  // Android's back button does what the visible control does, and what the sheet's Stay does while it's open.
  const askingRef = useRef(asking);
  useEffect(() => { askingRef.current = asking; }, [asking]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (askingRef.current) { setAsking(null); return true; }
      if (!stack.current.length) return false; // Today: let the system decide.
      close();
      return true;
    });
    return () => listener.remove();
  }, [close]);

  const value = useMemo(() => ({ register, closable: top?.kind === 'flow', closeBusy: Boolean(top?.busy), close, goHome, refresh }), [register, top?.kind, top?.busy, close, goHome, refresh]);
  return <NavContext.Provider value={value}>
    {children}
    {asking && <LeaveSheet reason={asking.reason} onStay={() => setAsking(null)} onLeave={() => { const go = asking.leave; setAsking(null); go(); }} />}
  </NavContext.Provider>;
}

/** The app's own sheet, never a system dialog. Leaving here makes no request of its own. */
function LeaveSheet({ reason, onStay, onLeave }: { reason: string; onStay: () => void; onLeave: () => void }) { const local = useLocal(); const styles = useStyles();
  return <Modal transparent visible animationType="none" onRequestClose={onStay}>
    <View style={local.scrim}>
      <Pressable accessibilityElementsHidden importantForAccessibility="no" onPress={onStay} style={StyleSheet.absoluteFill} />
      <View accessibilityViewIsModal style={local.sheet}>
        <Copy accessibilityRole="header" style={local.title}>Leave without saving?</Copy>
        <Copy style={styles.muted}>{reason}</Copy>
        <View style={local.actions}>
          <Action wide label="Stay" onPress={onStay} />
          <Action wide secondary label="Leave" onPress={onLeave} />
        </View>
      </View>
    </View>
  </Modal>;
}

const useLocal = themedStyles(COLORS => StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  sheet: { width: '100%', maxWidth: LAYOUT.contentWidth / 3, alignSelf: 'center', gap: SPACING.sm, padding: SPACING.lg, paddingBottom: SPACING.xl, borderTopLeftRadius: RADII.card, borderTopRightRadius: RADII.card, borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line, backgroundColor: COLORS.raised },
  title: { fontFamily: FONT_FAMILIES.display, ...NATIVE_TYPOGRAPHY.title },
  actions: { gap: SPACING.sm, marginTop: SPACING.md },
}));
