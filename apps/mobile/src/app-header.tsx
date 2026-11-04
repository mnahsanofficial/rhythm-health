import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line, Path } from 'react-native-svg';
import { FONT_FAMILIES, LAYOUT, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import { Copy, useStyles } from './ui';
import { Mark } from './logo';
import { useNav } from './nav';
import { ThemeControl, ThemeCycleButton } from './theme';
import { useColors, themedStyles } from './theme-core';

const fixedRow = { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs } as const;

export type Section = 'lab' | 'progress' | 'ask' | 'history' | 'you' | 'demo' | 'reminders';

function CloseIcon() { const COLORS = useColors();
  return <Svg width={SPACING.lg - SPACING.xs} height={SPACING.lg - SPACING.xs} viewBox="0 0 20 20" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Path d="M5 5l10 10M15 5L5 15" stroke={COLORS.ink} strokeWidth={1.75} strokeLinecap="round" fill="none" />
  </Svg>;
}
function MenuIcon() { const COLORS = useColors();
  return <Svg width={SPACING.md} height={SPACING.md} viewBox="0 0 20 20" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {[6, 10, 14].map(y => <Line key={y} x1={3.5} x2={16.5} y1={y} y2={y} stroke={COLORS.muted} strokeWidth={1.75} strokeLinecap="round" />)}
  </Svg>;
}

type Account = { email: string; onSignOut: () => void };

/**
 * Pinned above the scrolling page with a solid background and a border. Once there's a profile the tab bar and You
 * hold everything, so `account` is only passed before that: setup's way out, kept out of the flow itself.
 */
export function AppHeader({ account, onHome, signedIn = false }: { account?: Account; onHome?: () => void; signedIn?: boolean }) { const COLORS = useColors(); const local = useLocal();
  const nav = useNav();
  const brand = <><Mark size={SPACING.lg} /><Copy style={local.name}>Rhythm</Copy></>;
  return <View testID="app-header" style={local.bar}>
    {onHome
      ? <Pressable accessibilityRole="link" accessibilityLabel="Rhythm, home" onPress={() => nav.goHome(onHome)} style={({ pressed }) => [local.brand, pressed && { opacity: 0.6 }]}>{brand}</Pressable>
      : <View style={local.brand}>{brand}</View>}
    <View style={fixedRow}>
      {!signedIn && <ThemeCycleButton />}
      {account && !nav.closable && <AccountMenu account={account} />}
      {nav.closable && <Pressable accessibilityRole="button" accessibilityLabel="Close" accessibilityState={{ disabled: nav.closeBusy }} disabled={nav.closeBusy} onPress={nav.close}
        style={({ pressed }) => [local.close, pressed && { backgroundColor: COLORS.line }, nav.closeBusy && { opacity: 0.4 }]}><CloseIcon /></Pressable>}
    </View>
  </View>;
}

function AccountMenu({ account }: { account: Account }) { const COLORS = useColors(); const local = useLocal(); const ui = useStyles();
  const [open, setOpen] = useState(false);
  const choose = (action: () => void) => () => { setOpen(false); action(); };
  const trigger = <Pressable accessibilityRole="button" accessibilityLabel={`Account menu for ${account.email}`} accessibilityState={{ expanded: open }}
    onPress={() => setOpen(value => !value)} style={({ pressed }) => [local.trigger, (pressed || open) && { backgroundColor: COLORS.line }]}>
    <View style={local.initial}><Copy style={local.initialText}>{account.email.charAt(0)}</Copy></View>
    <MenuIcon />
  </Pressable>;
  return <>
    {trigger}
    {open && <Modal transparent visible animationType="none" onRequestClose={() => setOpen(false)}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={['top', 'left', 'right']} pointerEvents="box-none">
          <View style={local.panelRow} pointerEvents="box-none">
            <View style={local.panel}>
              <View style={local.who}>
                <Copy style={ui.muted}>Signed in as</Copy>
                <Copy style={local.email}>{account.email}</Copy>
              </View>
              <View style={local.who}><ThemeControl /></View>
              <Row label="Sign out" onPress={choose(account.onSignOut)} />
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>}
  </>;
}

function Row({ label, onPress }: { label: string; onPress: () => void }) { const COLORS = useColors(); const local = useLocal();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={({ pressed }) => [local.row, pressed && { backgroundColor: COLORS.oat }]}>
    <Copy>{label}</Copy>
  </Pressable>;
}

const useLocal = themedStyles(COLORS => StyleSheet.create({
  bar: { zIndex: 1, minHeight: LAYOUT.headerHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm, paddingHorizontal: LAYOUT.gutter.min, backgroundColor: COLORS.oat, borderBottomWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line },
  brand: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexShrink: 1, minHeight: LAYOUT.primaryAction },
  close: { minHeight: LAYOUT.primaryAction, minWidth: LAYOUT.primaryAction, alignItems: 'center', justifyContent: 'center', borderRadius: RADII.pill },
  name: { fontFamily: FONT_FAMILIES.display, ...NATIVE_TYPOGRAPHY.title, color: COLORS.ink },
  trigger: { minHeight: LAYOUT.primaryAction, minWidth: LAYOUT.primaryAction, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xs, paddingLeft: SPACING.xs, paddingRight: SPACING.sm, borderRadius: RADII.pill },
  initial: { minWidth: SPACING.xl + SPACING.xs, minHeight: SPACING.xl + SPACING.xs, alignItems: 'center', justifyContent: 'center', borderRadius: RADII.pill, backgroundColor: COLORS.moss },
  initialText: { fontFamily: FONT_FAMILIES.sansMedium, color: COLORS['on-accent'], textTransform: 'uppercase' },
  panelRow: { alignItems: 'flex-end', paddingHorizontal: LAYOUT.gutter.min, paddingTop: LAYOUT.headerHeight },
  panel: { width: '100%', maxWidth: LAYOUT.headerHeight * 4.5, padding: SPACING.sm, borderRadius: RADII.card, borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line, backgroundColor: COLORS.paper },
  who: { paddingHorizontal: SPACING.sm + SPACING.xs, paddingTop: SPACING.sm + SPACING.xs, paddingBottom: SPACING.sm },
  email: { fontFamily: FONT_FAMILIES.sansMedium },
  row: { minHeight: LAYOUT.primaryAction, justifyContent: 'center', paddingHorizontal: SPACING.sm + SPACING.xs, borderRadius: RADII.card },
}));
