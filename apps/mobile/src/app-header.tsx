import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { FONT_FAMILIES, LAYOUT, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import { Copy, useStyles } from './ui';
import { ThemeControl, ThemeCycleButton } from './theme';
import { useColors, themedStyles } from './theme-core';

const fixedRow = { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs } as const;

export type Section = 'lab' | 'history' | 'demo' | 'reminders';
const SECTIONS: { key: Section; label: string }[] = [{ key: 'lab', label: 'Your lab' }, { key: 'history', label: 'History' }, { key: 'demo', label: 'Demo' }];

/** The web's mark: a 24-hour dial, midnight at the top, with night from 22:00 to 06:00 and a midday sun. */
function Mark() { const COLORS = useColors();
  return <Svg width={SPACING.lg} height={SPACING.lg} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Circle cx={12} cy={12} r={10} fill={COLORS.paper} stroke={COLORS.ink} strokeWidth={1.5} />
    <Path d="M12 12 L7.5 4.21 A9 9 0 0 1 21 12 Z" fill={COLORS.night} />
    <Circle cx={10.3} cy={18.3} r={2} fill={COLORS.sun} stroke={COLORS.ink} strokeWidth={0.75} />
  </Svg>;
}
function MenuIcon() { const COLORS = useColors();
  return <Svg width={SPACING.md} height={SPACING.md} viewBox="0 0 20 20" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {[6, 10, 14].map(y => <Line key={y} x1={3.5} x2={16.5} y1={y} y2={y} stroke={COLORS.muted} strokeWidth={1.75} strokeLinecap="round" />)}
  </Svg>;
}

type Account = {
  email: string; section: Section; hasProfile: boolean;
  onSection: (next: Section) => void; onEditProfile: () => void; onSignOut: () => void;
};

/** Pinned above the scrolling page with a solid background and a border, as on the web at phone width. */
export function AppHeader({ account }: { account?: Account }) { const local = useLocal();
  return <View testID="app-header" style={local.bar}>
    <View style={local.brand}>
      <Mark />
      <Copy style={local.name}>Rhythm</Copy>
    </View>
    <View style={fixedRow}>
      {!account && <ThemeCycleButton />}
      {account && <AccountMenu account={account} />}
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
              {account.hasProfile && <View style={local.sections}>
                {SECTIONS.map(({ key, label }) => <Row key={key} label={label} selected={account.section === key} onPress={choose(() => account.onSection(key))} />)}
              </View>}
              <View style={local.who}>
                <Copy style={ui.muted}>Signed in as</Copy>
                <Copy style={local.email}>{account.email}</Copy>
              </View>
              {account.hasProfile && <>
                <Row label="Update your rhythm" onPress={choose(account.onEditProfile)} />
                <Row label="Daily reminders" selected={account.section === 'reminders'} onPress={choose(() => account.onSection('reminders'))} />
              </>}
              <View style={local.who}><ThemeControl /></View>
              <Row label="Sign out" onPress={choose(account.onSignOut)} />
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>}
  </>;
}

function Row({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) { const COLORS = useColors(); const local = useLocal();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress}
    style={({ pressed }) => [local.row, pressed && { backgroundColor: COLORS.oat }]}>
    <Copy style={selected ? local.current : undefined}>{label}</Copy>
  </Pressable>;
}

const useLocal = themedStyles(COLORS => StyleSheet.create({
  bar: { minHeight: LAYOUT.headerHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm, paddingHorizontal: LAYOUT.gutter.min, backgroundColor: COLORS.oat, borderBottomWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line },
  brand: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexShrink: 1 },
  name: { fontFamily: FONT_FAMILIES.display, ...NATIVE_TYPOGRAPHY.title, color: COLORS.ink },
  trigger: { minHeight: LAYOUT.primaryAction, minWidth: LAYOUT.primaryAction, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xs, paddingLeft: SPACING.xs, paddingRight: SPACING.sm, borderRadius: RADII.pill },
  initial: { minWidth: SPACING.xl + SPACING.xs, minHeight: SPACING.xl + SPACING.xs, alignItems: 'center', justifyContent: 'center', borderRadius: RADII.pill, backgroundColor: COLORS.moss },
  initialText: { fontFamily: FONT_FAMILIES.sansMedium, color: COLORS['on-accent'], textTransform: 'uppercase' },
  panelRow: { alignItems: 'flex-end', paddingHorizontal: LAYOUT.gutter.min, paddingTop: LAYOUT.headerHeight },
  panel: { width: '100%', maxWidth: LAYOUT.headerHeight * 4.5, padding: SPACING.sm, borderRadius: RADII.card, borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line, backgroundColor: COLORS.paper },
  sections: { paddingBottom: SPACING.sm, borderBottomWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line },
  who: { paddingHorizontal: SPACING.sm + SPACING.xs, paddingTop: SPACING.sm + SPACING.xs, paddingBottom: SPACING.sm },
  email: { fontFamily: FONT_FAMILIES.sansMedium },
  row: { minHeight: LAYOUT.primaryAction, justifyContent: 'center', paddingHorizontal: SPACING.sm + SPACING.xs, borderRadius: RADII.card },
  current: { fontFamily: FONT_FAMILIES.sansMedium, color: COLORS.moss },
}));
