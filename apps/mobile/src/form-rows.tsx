import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FONT_FAMILIES, LAYOUT, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import { Icon, type IconName } from './icons';
import { Copy, useStyles } from './ui';
import { themedStyles, useColors } from './theme-core';

/** Icon, label, value, chevron: one button per row. The value wraps under the label at large text. */
export function FormRow({ icon, label, value, onPress, disabled = false, hint = 'Change', name, trailing }: {
  icon?: IconName; label: string; value?: string; onPress?: () => void; disabled?: boolean; hint?: string; name?: string; trailing?: ReactNode;
}) { const COLORS = useColors(); const local = useLocal();
  const body = <>
    {icon && <Icon name={icon} />}
    <View style={local.words}>
      <Copy style={local.label}>{label}</Copy>
      {value !== undefined && <Copy style={local.value}>{value}</Copy>}
    </View>
    {trailing ?? (onPress && <Icon name="chevron" size={20} color={COLORS.muted} />)}
  </>;
  if (!onPress) return <View style={local.row}>{body}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={name ?? (value ? `${label}: ${value}` : label)} accessibilityHint={hint} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [local.row, pressed && { backgroundColor: COLORS['accent-tint'] }]}>{body}</Pressable>;
}

/** A group of rows reads as one list, so only the group has an edge. */
export function FormRows({ children }: { children: ReactNode }) { const local = useLocal();
  return <View style={local.group}>{children}</View>;
}

/** One value and two round buttons. To a screen reader, it's a single adjustable control as well as the two buttons. */
export function Stepper({ label, value, unit, lessName, moreName, canLess, canMore, onLess, onMore }: {
  label: string; value: number; unit: string; lessName: string; moreName: string; canLess: boolean; canMore: boolean; onLess: () => void; onMore: () => void;
}) { const local = useLocal(); const ui = useStyles();
  return <View style={local.stepper}>
    <Round icon="minus" name={lessName} disabled={!canLess} onPress={onLess} />
    <View accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: `${value} ${unit}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === 'increment' && canMore) onMore();
        if (nativeEvent.actionName === 'decrement' && canLess) onLess();
      }} style={local.reading}>
      <Copy style={[ui.number, local.amount]}>{value}</Copy>
      <Copy style={local.value}>{unit}</Copy>
    </View>
    <Round icon="plus" name={moreName} disabled={!canMore} onPress={onMore} />
  </View>;
}
function Round({ icon, name, disabled, onPress }: { icon: IconName; name: string; disabled: boolean; onPress: () => void }) { const COLORS = useColors(); const local = useLocal();
  return <Pressable accessibilityRole="button" accessibilityLabel={name} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [local.round, pressed && { backgroundColor: COLORS['accent-tint'] }, disabled && { borderColor: COLORS.border }]}>
    <Icon name={icon} color={disabled ? COLORS.muted : COLORS.text} />
  </Pressable>;
}

/** "Why?" or "More": a quiet control that opens in place. Reasons live here, never anything needed in order to act. */
export function Disclosure({ label = 'Why?', children }: { label?: string; children: ReactNode }) { const COLORS = useColors(); const local = useLocal();
  const [open, setOpen] = useState(false);
  return <View style={local.disclosure}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)}
      style={({ pressed }) => [local.toggle, pressed && { opacity: 0.6 }]}>
      <Copy style={local.toggleText}>{label}</Copy>
      <View style={open ? local.turned : undefined}><Icon name="chevronDown" size={20} color={COLORS.accent} /></View>
    </Pressable>
    {open && <View style={local.opened}>{children}</View>}
  </View>;
}

const useLocal = themedStyles(COLORS => StyleSheet.create({
  group: { borderRadius: RADII.card, borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.control, backgroundColor: COLORS.surface, overflow: 'hidden' },
  row: { minHeight: LAYOUT.primaryAction + SPACING.sm, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border },
  words: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: SPACING.md },
  label: { fontFamily: FONT_FAMILIES.sansMedium },
  value: { color: COLORS.muted, flexShrink: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
  reading: { flex: 1, alignItems: 'center' },
  amount: { ...NATIVE_TYPOGRAPHY.headline },
  round: { minHeight: LAYOUT.primaryAction + SPACING.sm, minWidth: LAYOUT.primaryAction + SPACING.sm, alignItems: 'center', justifyContent: 'center', borderRadius: RADII.pill, borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.control, backgroundColor: COLORS.surface },
  disclosure: { gap: SPACING.xs },
  toggle: { minHeight: LAYOUT.primaryAction, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  toggleText: { fontFamily: FONT_FAMILIES.sansMedium, color: COLORS.accent },
  turned: { transform: [{ rotate: '180deg' }] },
  opened: { gap: SPACING.sm, paddingBottom: SPACING.sm },
}));
