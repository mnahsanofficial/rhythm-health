import { createContext, useCallback, useContext, useEffect, useRef, type ComponentRef, type ReactNode, type Ref } from 'react';
import { AccessibilityInfo, findNodeHandle, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, View, type TextProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONT_FAMILIES, LAYOUT, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';

const FontAvailability = createContext(true);
const ScrollToTop = createContext<() => void>(() => undefined);
export function Copy(props: TextProps & { ref?: Ref<ComponentRef<typeof Text>> }) {
  const available = useContext(FontAvailability);
  return <Text {...props} style={[styles.body, props.style, !available && { fontFamily: undefined }]} />;
}
export function Title({ children, textRef }: { children: ReactNode; textRef?: Ref<ComponentRef<typeof Text>> }) { return <Copy ref={textRef} accessibilityRole="header" style={styles.title}>{children}</Copy>; }
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
export function Alert({ children }: { children: ReactNode }) {
  return <Copy accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.alert}>{children}</Copy>;
}
export function Action({ label, name, onPress, disabled = false, secondary = false, link = false, selected }: {
  label: string; name?: string; onPress: () => void; disabled?: boolean; secondary?: boolean; link?: boolean; selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={link ? 'link' : 'button'}
      accessibilityLabel={name ?? label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.action, secondary && styles.secondary,
        pressed && { backgroundColor: secondary ? COLORS['moss-tint'] : COLORS['moss-deep'] }, disabled && styles.disabled]}
    >
      <Copy style={[styles.actionText, secondary && { color: COLORS.moss }]}>{label}</Copy>
    </Pressable>
  );
}
export function Frame({ children, fontsReady = true }: { children: ReactNode; fontsReady?: boolean }) {
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const scrollToTop = useCallback(() => { scroller.current?.scrollTo?.({ y: 0, animated: false }); }, []);
  return (
    <FontAvailability.Provider value={fontsReady}><ScrollToTop.Provider value={scrollToTop}><SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView ref={scroller} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <Copy style={styles.wordmark}>Rhythm</Copy>
          <View style={styles.content}>{children}</View>
        </View>
      </ScrollView>
    </SafeAreaView></ScrollToTop.Provider></FontAvailability.Provider>
  );
}
export function Loading({ message }: { message: string }) {
  return (
    <View style={styles.stack}>
      <Copy accessibilityLiveRegion="polite">{message}</Copy>
      <View accessible={false} style={styles.skeletonTitle} />
      <View accessible={false} style={styles.skeletonBody} />
      <View accessible={false} style={styles.skeletonAction} />
    </View>
  );
}
export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.oat },
  scroll: { flexGrow: 1, padding: LAYOUT.gutter.min },
  column: { width: '100%', maxWidth: LAYOUT.contentWidth / 3, alignSelf: 'center' },
  wordmark: { fontFamily: FONT_FAMILIES.display, ...NATIVE_TYPOGRAPHY.title, paddingVertical: SPACING.md, color: COLORS.ink },
  content: { paddingTop: SPACING.xl, paddingBottom: SPACING.xxl, gap: SPACING.lg },
  body: { fontFamily: FONT_FAMILIES.sans, ...NATIVE_TYPOGRAPHY.body, color: COLORS.ink, flexShrink: 1 },
  title: { fontFamily: FONT_FAMILIES.display, ...NATIVE_TYPOGRAPHY['display-sm'], color: COLORS.ink },
  number: { fontFamily: FONT_FAMILIES.mono, ...NATIVE_TYPOGRAPHY.body, color: COLORS.moss },
  sectionTitle: { fontFamily: FONT_FAMILIES.display, ...NATIVE_TYPOGRAPHY.title },
  decision: { padding: SPACING.lg, borderRadius: RADII.card, backgroundColor: COLORS['moss-tint'], gap: SPACING.md },
  muted: { color: COLORS.muted },
  label: { marginBottom: SPACING.sm },
  input: { fontFamily: FONT_FAMILIES.sans, ...NATIVE_TYPOGRAPHY.body, color: COLORS.ink,
    minHeight: LAYOUT.primaryAction, backgroundColor: COLORS.paper, borderWidth: LAYOUT.focusWidth / 2,
    borderColor: COLORS.line, borderRadius: RADII.card, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  focus: { borderColor: COLORS.moss, borderWidth: LAYOUT.focusWidth },
  stack: { gap: SPACING.md },
  action: { minHeight: LAYOUT.primaryAction, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.moss, borderRadius: RADII.pill, alignItems: 'center', justifyContent: 'center' },
  actionText: { ...NATIVE_TYPOGRAPHY.lead, color: COLORS.paper, textAlign: 'center' },
  secondary: { backgroundColor: COLORS.paper, borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line },
  disabled: { opacity: 0.5 },
  alert: { color: COLORS.clay, backgroundColor: COLORS['clay-tint'], padding: SPACING.md, borderRadius: RADII.card },
  divider: { borderTopWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line, paddingTop: SPACING.lg, gap: SPACING.md },
  skeletonTitle: { height: LAYOUT.primaryAction, width: '80%', backgroundColor: COLORS.line, borderRadius: RADII.pill },
  skeletonBody: { height: LAYOUT.headerHeight, backgroundColor: COLORS.line, borderRadius: RADII.card },
  skeletonAction: { height: LAYOUT.primaryAction, backgroundColor: COLORS['moss-tint'], borderRadius: RADII.pill },
});
