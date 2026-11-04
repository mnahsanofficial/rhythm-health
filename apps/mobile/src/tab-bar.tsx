import { Pressable, StyleSheet, View } from 'react-native';
import { LAYOUT, NATIVE_TYPOGRAPHY, RADII, SPACING, FONT_FAMILIES } from '@rhythm-health/brand';
import type { Section } from './app-header';
import { Icon, type IconName } from './icons';
import { useNav } from './nav';
import { Copy } from './ui';
import { themedStyles, useColors } from './theme-core';

const TABS: { key: Section; label: string; icon: IconName }[] = [
  { key: 'lab', label: 'Today', icon: 'today' },
  { key: 'progress', label: 'Progress', icon: 'progress' },
  { key: 'ask', label: 'Ask', icon: 'ask' },
  { key: 'history', label: 'History', icon: 'history' },
  { key: 'you', label: 'You', icon: 'you' },
];
/** The screens opened from You keep You selected. */
const tabOf = (section: Section): Section => section === 'demo' || section === 'reminders' ? 'you' : section;

/** On the five main screens only. A flow has its own action and ×, so the bar steps aside. */
export function TabBar({ section, onSection }: { section: Section; onSection: (next: Section) => void }) { const COLORS = useColors(); const local = useLocal();
  const { closable } = useNav();
  if (closable) return null;
  const current = tabOf(section);
  return <View accessibilityRole="tablist" style={local.bar}>
    {TABS.map(({ key, label, icon }) => {
      const selected = current === key;
      const ask = key === 'ask';
      return <Pressable key={key} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} onPress={() => onSection(key)}
        style={({ pressed }) => [local.tab, pressed && { opacity: 0.6 }]}>
        <View style={ask ? local.askDisc : undefined}>
          <Icon name={icon} filled={selected} color={ask ? COLORS['on-accent'] : selected ? COLORS.accent : COLORS.muted} />
        </View>
        <Copy maxFontSizeMultiplier={1.3} numberOfLines={1} style={[local.label, selected && local.selected]}>{label}</Copy>
      </Pressable>;
    })}
  </View>;
}

const useLocal = themedStyles(COLORS => StyleSheet.create({
  bar: { flexDirection: 'row', minHeight: SPACING.xxl + SPACING.sm, paddingTop: SPACING.xs, borderTopWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.border, backgroundColor: COLORS.background },
  tab: { flex: 1, minHeight: LAYOUT.primaryAction, alignItems: 'center', justifyContent: 'center', gap: 2 },
  askDisc: { width: SPACING.xl, height: SPACING.xl, marginTop: -SPACING.xs, alignItems: 'center', justifyContent: 'center', borderRadius: RADII.pill, backgroundColor: COLORS.accent },
  label: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  selected: { fontFamily: FONT_FAMILIES.sansMedium, color: COLORS.accent },
}));
