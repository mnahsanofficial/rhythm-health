import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import type { Metric } from '@rhythm-health/contract';
import { COLORS, LAYOUT, RADII, SPACING } from '@rhythm-health/brand';
import { Copy, styles } from './ui';

export function Radio({ label, selected, onPress, disabled, text = label }: {
  label: string; text?: string; selected: boolean; onPress: () => void; disabled: boolean;
}) {
  return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected, disabled }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => ({
      minHeight: LAYOUT.primaryAction, minWidth: LAYOUT.primaryAction, justifyContent: 'center', alignItems: 'center',
      padding: SPACING.sm, borderRadius: RADII.card, borderWidth: LAYOUT.focusWidth / 2,
      borderColor: selected ? COLORS.moss : COLORS.line, backgroundColor: selected || pressed ? COLORS['moss-tint'] : COLORS.paper,
    })}><Copy>{text}</Copy></Pressable>;
}
const scaleWords: Record<string, readonly [string, string]> = {
  morning_energy: ['Drained', 'Full of energy'], sleep_quality: ['Restless', 'Restful'],
  focus: ['Distracted', 'Focused'], stress: ['Calm', 'Very stressed'],
};
export function MetricInput({ metric, value, onChange, disabled, error }: {
  metric: Metric; value: string | boolean | undefined; onChange: (value: string | boolean) => void; disabled: boolean; error?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [low, high] = scaleWords[metric.key] ?? ['Low', 'High'];
  const min = metric.min ?? 1, max = metric.max ?? 10;
  return <View style={styles.stack}>
    <Copy>{metric.label}</Copy>
    {metric.type === 'scale' && <Copy style={styles.muted}>{min} {low} · {max} {high}</Copy>}
    {metric.type === 'boolean' ? <View accessibilityRole="radiogroup" accessibilityLabel={metric.label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
      {[true, false].map(choice => <Radio key={String(choice)} label={`${metric.label}: ${choice ? 'Yes' : 'No'}`} text={choice ? 'Yes' : 'No'}
        selected={value === choice} onPress={() => onChange(choice)} disabled={disabled} />)}
    </View> : metric.type === 'scale' && max - min <= 20 ? <View accessibilityRole="radiogroup" accessibilityLabel={metric.label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
      {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(choice => <Radio key={choice} label={`${metric.label}: ${choice}`} text={String(choice)}
        selected={value === String(choice)} onPress={() => onChange(String(choice))} disabled={disabled} />)}
    </View> : <TextInput accessibilityLabel={metric.type === 'duration' ? `${metric.label}, in minutes` : metric.label}
      value={typeof value === 'string' ? value : ''} onChangeText={onChange} editable={!disabled}
      inputMode={metric.type === 'number' ? undefined : 'decimal'} keyboardType={metric.type === 'number' ? 'numbers-and-punctuation' : 'decimal-pad'}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={[styles.input, focused && styles.focus]} />}
    {metric.type === 'duration' && <Copy style={styles.muted}>In minutes</Copy>}
    {error && <Copy style={{ color: COLORS.clay }}>{error}</Copy>}
  </View>;
}
