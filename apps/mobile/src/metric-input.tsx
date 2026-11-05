import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import type { Metric } from '@rhythm-health/contract';
import { LAYOUT, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import { Copy, useStyles } from './ui';
import { useColors } from './theme-core';

/** What the ends of a scale mean. */
export function scaleCaption(metric: Metric) {
  return `${metric.min ?? 1} ${metric.min_label ?? 'Low'} · ${metric.max ?? 10} ${metric.max_label ?? 'High'}`;
}

export function Radio({ label, selected, onPress, disabled, text = label, cell = false, big = false }: {
  label: string; text?: string; selected: boolean; onPress: () => void; disabled: boolean;
  /** One question on the screen, so its answers can take the room. */
  big?: boolean;
  /** One of a scale's numbers: five to a row, so ten always make two even rows. */
  cell?: boolean;
}) { const COLORS = useColors();
  return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected, disabled }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => ({
      minHeight: big ? LAYOUT.primaryAction + SPACING.lg : LAYOUT.primaryAction, minWidth: LAYOUT.primaryAction, justifyContent: 'center', alignItems: 'center',
      padding: SPACING.sm, borderRadius: RADII.control, borderWidth: LAYOUT.focusWidth / 2,
      ...(cell ? { flexBasis: '18%', flexGrow: 1 } : null),
      borderColor: selected ? COLORS.accent : COLORS.control, backgroundColor: selected ? COLORS.moss : pressed ? COLORS['moss-tint'] : COLORS.paper,
    })}><Copy style={[big && NATIVE_TYPOGRAPHY.lead, selected && { color: COLORS['on-accent'] }]}>{text}</Copy></Pressable>;
}
export function MetricInput({ metric, value, onChange, disabled, error, big = false }: {
  metric: Metric; value: string | boolean | undefined; onChange: (value: string | boolean) => void; disabled: boolean; error?: string;
  /** The check-in's own step: its heading names the metric and carries the scale's caption, and the answers are large. */
  big?: boolean;
}) { const COLORS = useColors(); const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const min = metric.min ?? 1, max = metric.max ?? 10;
  return <View style={styles.stack}>
    {!big && <Copy testID="metric-label" accessibilityRole="header" style={styles.sectionTitle}>{metric.label}</Copy>}
    {!big && metric.type === 'scale' && <Copy style={styles.muted}>{scaleCaption(metric)}</Copy>}
    {metric.type === 'boolean' ? <View accessibilityRole="radiogroup" accessibilityLabel={metric.label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
      {[true, false].map(choice => <Radio key={String(choice)} label={`${metric.label}: ${choice ? 'Yes' : 'No'}`} text={choice ? 'Yes' : 'No'} big={big} cell={big}
        selected={value === choice} onPress={() => onChange(choice)} disabled={disabled} />)}
    </View> : metric.type === 'scale' && max - min <= 20 ? <View accessibilityRole="radiogroup" accessibilityLabel={metric.label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
      {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(choice => <Radio key={choice} cell big={big} label={`${metric.label}: ${choice}`} text={String(choice)}
        selected={value === String(choice)} onPress={() => onChange(String(choice))} disabled={disabled} />)}
    </View> : <TextInput accessibilityLabel={metric.type === 'duration' ? `${metric.label}, in minutes` : metric.label}
      value={typeof value === 'string' ? value : ''} onChangeText={onChange} editable={!disabled}
      inputMode={metric.type === 'number' ? undefined : 'decimal'} keyboardType={metric.type === 'number' ? 'numbers-and-punctuation' : 'decimal-pad'}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={[styles.input, focused && styles.focus]} />}
    {metric.type === 'duration' && <Copy style={styles.muted}>In minutes</Copy>}
    {error && <Copy style={{ color: COLORS.clay }}>{error}</Copy>}
  </View>;
}
