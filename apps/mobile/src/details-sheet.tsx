import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { LAYOUT, RADII, SPACING } from '@rhythm-health/brand';
import { Icon } from './icons';
import { themedStyles, useColors } from './theme-core';
import { Action, Copy, useStyles } from './ui';

/** One line on the screen, the detail in a sheet: how a main screen stays within its text budget. */
export function DetailsRow({ label, title = label, children }: { label: string; title?: string; children: ReactNode }) {
  const COLORS = useColors(); const local = useLocal(); const styles = useStyles();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Opens the details" onPress={() => setOpen(true)}
      style={({ pressed }) => [local.row, pressed && { backgroundColor: COLORS['accent-tint'] }]}>
      <Copy style={local.label}>{label}</Copy>
      <Icon name="chevron" size={SPACING.lg - SPACING.xs} />
    </Pressable>
    <Modal visible={open} transparent animationType={reduce ? 'none' : 'slide'} onRequestClose={() => setOpen(false)}>
      <View style={local.backdrop}>
        <Pressable accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={local.dismiss} onPress={() => setOpen(false)} />
        <View accessibilityViewIsModal style={local.sheet}>
          <Copy accessibilityRole="header" style={styles.sectionTitle}>{title}</Copy>
          <ScrollView contentContainerStyle={local.body}>{children}</ScrollView>
          <Action wide secondary label="Done" onPress={() => setOpen(false)} />
        </View>
      </View>
    </Modal>
  </>;
}

const useLocal = themedStyles(COLORS => StyleSheet.create({
  row: { minHeight: LAYOUT.primaryAction, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  label: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  dismiss: { flex: 1 },
  sheet: { maxHeight: '85%', gap: SPACING.md, padding: SPACING.lg, borderTopLeftRadius: RADII.card, borderTopRightRadius: RADII.card, backgroundColor: COLORS.surface },
  body: { gap: SPACING.sm },
}));
