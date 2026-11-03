import { useId, useState } from 'react';
import { View } from 'react-native';
import { FONT_FAMILIES, LAYOUT, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import { Copy, useStyles } from './ui';
import { useColors } from './theme-core';

/** Expo web uses the browser's native time control; phones use the system picker. */
export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { const COLORS = useColors(); const styles = useStyles();
  const id = useId(); const [focused, setFocused] = useState(false);
  return <View style={styles.stack}>
    <Copy nativeID={`${id}-label`} style={styles.label}>{label}</Copy>
    <input aria-label={label} aria-labelledby={`${id}-label`} type="time" value={value} required onChange={event => onChange(event.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ boxSizing: 'border-box', width: '100%', minHeight: LAYOUT.primaryAction, padding: SPACING.sm,
        fontFamily: FONT_FAMILIES.sans, ...NATIVE_TYPOGRAPHY.body, lineHeight: `${NATIVE_TYPOGRAPHY.body.lineHeight}px`, color: COLORS.ink, background: COLORS.paper,
        border: `${focused ? LAYOUT.focusWidth : LAYOUT.focusWidth / 2}px solid ${focused ? COLORS.moss : COLORS.line}`, borderRadius: RADII.card }} />
  </View>;
}
