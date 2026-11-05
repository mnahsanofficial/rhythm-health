import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { AccessibilityInfo, findNodeHandle, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type TextProps } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { SafeAreaInsetsContext, SafeAreaView } from 'react-native-safe-area-context';
import { FONT_FAMILIES, LAYOUT, MOTION_DURATION_MS, MOTION_EASE, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import { useColors, themedStyles } from './theme-core';

const PRESSED_SCALE = 0.98;
const FontAvailability = createContext(true);
const ScrollToTop = createContext<(settle?: boolean) => void>(() => undefined);
const TopSlot = createContext<((node: ReactNode) => void) | null>(null);
const FooterSlot = createContext<((node: ReactNode) => void) | null>(null);
export function Copy(props: TextProps & { ref?: Ref<ComponentRef<typeof Text>> }) { const styles = useStyles();
  const available = useContext(FontAvailability);
  return <Text {...props} style={[styles.body, props.style, !available && { fontFamily: undefined }]} />;
}
export function Title({ children, textRef, small = false }: { children: ReactNode; textRef?: Ref<ComponentRef<typeof Text>>; small?: boolean }) { const styles = useStyles(); return <Copy ref={textRef} accessibilityRole="header" style={[styles.title, small && NATIVE_TYPOGRAPHY.headline]}>{children}</Copy>; }
/** A new step in a flow starts at its heading: back to the top, keyboard away, screen reader on the title. */
export function useStepFocus(step: string) {
  const heading = useRef<ComponentRef<typeof Text>>(null);
  const scrollToTop = useContext(ScrollToTop);
  useEffect(() => {
    scrollToTop();
    Keyboard.dismiss();
    const node = heading.current;
    if (!node) return;
    if (Platform.OS === 'web') node.focus?.();
    else { const tag = findNodeHandle(node); if (tag) AccessibilityInfo.setAccessibilityFocus(tag); }
  }, [step, scrollToTop]);
  return heading;
}
/** For a flow that moves focus itself: settle in and go to the top when `step` changes. */
export function useScreenEnter(step: unknown, settle = true) {
  const scrollToTop = useContext(ScrollToTop);
  useEffect(() => { scrollToTop(settle); }, [step, scrollToTop, settle]);
}
const spoken = (node: ReactNode): string => Array.isArray(node) ? node.map(spoken).join('') : typeof node === 'string' || typeof node === 'number' ? String(node) : '';
/** Android reads live regions; iOS ignores them, so VoiceOver needs an explicit announcement. */
function useAnnounce(text: string) {
  useEffect(() => { if (text && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text); }, [text]);
}
export function Status(props: TextProps) {
  useAnnounce(spoken(props.children));
  return <Copy accessibilityLiveRegion="polite" {...props} />;
}
/** Not an error: something to know, like being offline. */
export function Notice({ children }: { children: ReactNode }) { const styles = useStyles();
  useAnnounce(spoken(children));
  return <Copy accessibilityLiveRegion="polite" style={styles.notice}>{children}</Copy>;
}
/** A real count arriving: only for counts, never for results or other health estimates. */
export function CountUp({ value, suffix = '', style }: { value: number; suffix?: string; style?: TextProps['style'] }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (reduce || value === 0) return;
    const started = Date.now();
    let frame = requestAnimationFrame(function step() {
      const progress = Math.min((Date.now() - started) / MOTION_DURATION_MS.response, 1);
      setShown(Math.round(value * progress));
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, reduce]);
  return <Copy style={style}>{`${reduce ? value : shown}${suffix}`}</Copy>;
}
export function Alert({ children }: { children: ReactNode }) { const styles = useStyles();
  useAnnounce(spoken(children));
  return <Copy accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.alert}>{children}</Copy>;
}
const PRESS_TIMING = { duration: MOTION_DURATION_MS.press, reduceMotion: ReduceMotion.System };
/**
 * Fits its words. One per screen without `secondary`; that one is the screen's primary action.
 * `wide` lines it up with what it belongs to: a form's fields, or the bottom of the phone's landing.
 */
export function Action({ label, name, onPress, disabled = false, secondary = false, link = false, selected, wide = false, testID, onDark, haptic = false }: {
  label: string; name?: string; onPress: () => void; disabled?: boolean; secondary?: boolean; link?: boolean; selected?: boolean; wide?: boolean; testID?: string;
  /** A secondary on a filled screen takes its edge and words from this colour. */
  onDark?: string; haptic?: boolean;
}) { const COLORS = useColors(); const styles = useStyles();
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Animated.View testID={testID} style={[wide ? styles.wide : styles.fit, pressStyle]}><Pressable
      accessibilityRole={link ? 'link' : 'button'}
      accessibilityLabel={name ?? label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={() => { if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      onPressIn={() => { if (!reduce) scale.set(withTiming(PRESSED_SCALE, PRESS_TIMING)); }}
      onPressOut={() => { if (!reduce) scale.set(withTiming(1, PRESS_TIMING)); }}
      style={({ pressed }) => [styles.action, secondary && styles.secondary, onDark ? { borderColor: onDark } : null,
        pressed && !onDark && { backgroundColor: secondary ? COLORS['accent-tint'] : COLORS['accent-press'] }, pressed && onDark ? { opacity: 0.7 } : null, disabled && styles.disabled]}
    >
      <Copy style={[styles.actionText, secondary && { color: onDark ?? COLORS.text }, disabled && { color: COLORS.muted }]}>{label}</Copy>
    </Pressable></Animated.View>
  );
}
/** The one way back from a detail screen: "‹ Today". The mark is visual; the spoken name says where it goes. */
export function BackLink({ to, name, onPress, disabled = false }: { to: string; name?: string; onPress: () => void; disabled?: boolean }) { const COLORS = useColors(); const styles = useStyles();
  return <Pressable accessibilityRole="button" accessibilityLabel={name ?? `Back to ${to.toLowerCase()}`} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.6 }, disabled && styles.disabled]}>
    <Copy style={{ color: COLORS.moss }}>‹ {to}</Copy>
  </Pressable>;
}
export function ForwardLink({ label, onPress }: { label: string; onPress: () => void }) { const COLORS = useColors(); const styles = useStyles();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.6 }]}>
    <Copy style={{ color: COLORS.moss, fontFamily: FONT_FAMILIES.sansMedium }}>{label}  →</Copy>
  </Pressable>;
}
/**
 * The screen's one primary action, held at the bottom outside the scroller so content and the keyboard can't hide it.
 * With no Frame around it (a screen rendered on its own), it stays in place.
 */
export function StickyAction({ children }: { children: ReactNode }) {
  const fill = useContext(FooterSlot);
  useEffect(() => { fill?.(children); }, [fill, children]);
  useEffect(() => () => fill?.(null), [fill]);
  return fill ? null : <>{children}</>;
}
/** Held above the scroller, under the header: what must stay in view while the content below it moves. */
export function PinnedTop({ children }: { children: ReactNode }) {
  const fill = useContext(TopSlot);
  useEffect(() => { fill?.(children); }, [fill, children]);
  useEffect(() => () => fill?.(null), [fill]);
  return fill ? null : <>{children}</>;
}
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const [show, hide] = Platform.OS === 'ios' ? ['keyboardWillShow', 'keyboardWillHide'] as const : ['keyboardDidShow', 'keyboardDidHide'] as const;
    const listeners = [Keyboard.addListener(show, () => setOpen(true)), Keyboard.addListener(hide, () => setOpen(false))];
    return () => listeners.forEach(listener => listener.remove());
  }, []);
  return open;
}
/** `bare` hands the whole screen, up under the status bar, to one that lays itself out and doesn't scroll. */
export function Frame({ children, header, tabs, fontsReady = true, bare = false }: { children: ReactNode; header?: ReactNode; tabs?: ReactNode; fontsReady?: boolean; bare?: boolean }) { const styles = useStyles();
  const [footer, setFooter] = useState<ReactNode>(null);
  const [top, setTop] = useState<ReactNode>(null);
  /** The bar floats over the scroller, so the content always ends this far above the bottom. Measured, because large text makes it taller. */
  const [footerHeight, setFooterHeight] = useState<number>(LAYOUT.primaryAction + SPACING.md);
  const keyboardOpen = useKeyboardOpen();
  const bottomInset = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const opacity = useSharedValue(1);
  const rise = useSharedValue(0);
  // Called when a flow moves to a new screen: back to the top, then a short settle that keeps your place.
  const scrollToTop = useCallback((settle = true) => {
    scroller.current?.scrollTo?.({ y: 0, animated: false });
    if (!settle) return;
    const timing = { duration: MOTION_DURATION_MS.panel, easing: Easing.bezier(...MOTION_EASE.settle), reduceMotion: ReduceMotion.System };
    opacity.set(0); rise.set(SPACING.xs + 2);
    opacity.set(withTiming(1, timing)); rise.set(withTiming(0, timing));
  }, [opacity, rise]);
  const enter = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ translateY: rise.get() }] }));
  return (
    <FontAvailability.Provider value={fontsReady}><ScrollToTop.Provider value={scrollToTop}><FooterSlot.Provider value={setFooter}><TopSlot.Provider value={setTop}><SafeAreaView style={styles.safe} edges={bare ? ['left', 'right'] : ['top', 'left', 'right']}>
      {header}
      {top}
      {bare ? <View style={[styles.bare, { paddingBottom: bottomInset }]}>{children}</View> : <KeyboardAvoidingView style={styles.bare} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.bare}>
          <ScrollView ref={scroller} style={styles.bare} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, footer ? { paddingBottom: footerHeight } : null]}>
            <View style={[styles.column, top ? styles.columnUnderTop : null]}>
              <Animated.View style={[styles.content, top ? styles.contentUnderTop : null, enter]}>{children}</Animated.View>
            </View>
          </ScrollView>
          {footer && <View testID="sticky-footer" onLayout={event => setFooterHeight(event.nativeEvent.layout.height)} style={styles.footer}><View style={[styles.column, styles.stack]}>{footer}</View></View>}
        </View>
        {!keyboardOpen && tabs}
        {!keyboardOpen && <View style={{ height: bottomInset }} />}
      </KeyboardAvoidingView>}
    </SafeAreaView></TopSlot.Provider></FooterSlot.Provider></ScrollToTop.Provider></FontAvailability.Provider>
  );
}
export function Loading({ message }: { message: string }) { const styles = useStyles();
  return (
    <View style={styles.stack}>
      <Status>{message}</Status>
      <View accessible={false} style={styles.skeletonTitle} />
      <View accessible={false} style={styles.skeletonBody} />
      <View accessible={false} style={styles.skeletonAction} />
    </View>
  );
}
export const useStyles = themedStyles(COLORS => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.oat },
  bare: { flex: 1 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: LAYOUT.gutter.min, paddingVertical: SPACING.sm, borderTopWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.border, backgroundColor: COLORS.background },
  hint: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  scroll: { flexGrow: 1, padding: LAYOUT.gutter.min },
  column: { width: '100%', maxWidth: LAYOUT.contentWidth / 3, alignSelf: 'center' },
  backLink: { minHeight: LAYOUT.primaryAction, alignSelf: 'flex-start', justifyContent: 'center' },
  content: { paddingTop: SPACING.lg, paddingBottom: SPACING.lg, gap: SPACING.lg },
  columnUnderTop: { flexGrow: 1 },
  contentUnderTop: { flexGrow: 1, paddingTop: SPACING.xs, paddingBottom: 0 },
  body: { fontFamily: FONT_FAMILIES.sans, ...NATIVE_TYPOGRAPHY.body, color: COLORS.ink },
  title: { fontFamily: FONT_FAMILIES.display, ...NATIVE_TYPOGRAPHY.headline, color: COLORS.ink },
  number: { fontFamily: FONT_FAMILIES.mono, ...NATIVE_TYPOGRAPHY.body, color: COLORS.text },
  sectionTitle: { fontFamily: FONT_FAMILIES.display, ...NATIVE_TYPOGRAPHY.title },
  decision: { padding: SPACING.lg, borderRadius: RADII.card, backgroundColor: COLORS['moss-tint'], gap: SPACING.md },
  muted: { color: COLORS.muted },
  label: { marginBottom: SPACING.sm },
  input: { fontFamily: FONT_FAMILIES.sans, ...NATIVE_TYPOGRAPHY.body, color: COLORS.ink,
    minHeight: LAYOUT.primaryAction, backgroundColor: COLORS.paper, borderWidth: LAYOUT.focusWidth / 2,
    borderColor: COLORS.control, borderRadius: RADII.control, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  focus: { borderColor: COLORS.moss, borderWidth: LAYOUT.focusWidth },
  stack: { gap: SPACING.sm + SPACING.xs },
  action: { minHeight: LAYOUT.primaryAction, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.moss, borderRadius: RADII.pill, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontFamily: FONT_FAMILIES.sansMedium, ...NATIVE_TYPOGRAPHY.body, color: COLORS['on-accent'], textAlign: 'center' },
  fit: { alignSelf: 'flex-start', maxWidth: LAYOUT.buttonMaxWidth },
  wide: { alignSelf: 'stretch' },
  secondary: { backgroundColor: 'transparent', borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.control },
  disabled: { backgroundColor: COLORS['accent-tint'], borderWidth: 0 },
  notice: { color: COLORS.text, backgroundColor: COLORS['warning-tint'], padding: SPACING.md, borderRadius: RADII.card },
  alert: { color: COLORS.clay, backgroundColor: COLORS['clay-tint'], padding: SPACING.md, borderRadius: RADII.card },
  divider: { borderTopWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line, paddingTop: SPACING.lg, gap: SPACING.md },
  skeletonTitle: { height: LAYOUT.primaryAction, width: '80%', backgroundColor: COLORS.line, borderRadius: RADII.pill },
  skeletonBody: { height: LAYOUT.headerHeight, backgroundColor: COLORS.line, borderRadius: RADII.card },
  skeletonAction: { height: LAYOUT.primaryAction, backgroundColor: COLORS['moss-tint'], borderRadius: RADII.pill },
}));
