import { useCallback, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { LAYOUT, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import { Radio } from './metric-input';
import { useNavScreen } from './nav';
import { Action, Copy, StickyAction, Title, useStepFocus, useStyles } from './ui';
import { themedStyles } from './theme-core';

/** Per device, like the theme. Expo web has no secure store, so it lasts until reload there. */
export const FIRST_RUN_KEY = 'rhythm-first-run';
let seenOnWeb = false;

/** An unreadable store counts as seen: better to miss the guide than to show it every time. */
export async function firstRunSeen(): Promise<boolean> {
  if (Platform.OS === 'web') return seenOnWeb;
  try { return await SecureStore.getItemAsync(FIRST_RUN_KEY) === 'seen'; } catch { return true; }
}
async function remember() {
  if (Platform.OS === 'web') { seenOnWeb = true; return; }
  try { await SecureStore.setItemAsync(FIRST_RUN_KEY, 'seen'); } catch { /* It may show once more. Nothing is lost. */ }
}

const MARKS = ['First, did you make your change today? Tap one.', 'Then, how did it go? Tap a number.', "That's a check-in: about 30 seconds a day."];

/** The first check-in, done by hand on an example. Everything here is on the phone: no request, and nothing is saved. */
export function FirstRunGuide({ onDone }: { onDone: () => void }) { const local = useLocal(); const ui = useStyles();
  const [step, setStep] = useState(1);
  const [changed, setChanged] = useState<boolean | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const leaving = useRef(false);
  const finish = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    void remember().then(onDone);
  }, [onDone]);
  useNavScreen({ kind: 'section', onBack: finish });
  const mark = useStepFocus(String(step));
  return <View style={ui.stack}>
    <View style={local.top}>
      <Copy style={local.step}>{`Example · Step ${step} of 3`}</Copy>
      <Action secondary label="Skip" onPress={finish} />
    </View>
    <Title>Try a check-in.</Title>
    <Copy ref={mark} accessibilityLiveRegion="polite" style={local.mark}>{MARKS[step - 1]}</Copy>
    <View style={[local.part, step === 1 && local.current]}>
      <Copy style={NATIVE_TYPOGRAPHY.lead}>Did you make the change today?</Copy>
      <View style={local.pair}>
        <View style={local.half}><Radio label="Yes, I made the change" text="Yes" selected={changed === true} disabled={false} onPress={() => { setChanged(true); if (step === 1) setStep(2); }} /></View>
        <View style={local.half}><Radio label="Not today" selected={changed === false} disabled={false} onPress={() => { setChanged(false); if (step === 1) setStep(2); }} /></View>
      </View>
    </View>
    {step > 1 && <View style={[local.part, step === 2 && local.current]}>
      <Copy style={NATIVE_TYPOGRAPHY.lead}>Morning energy</Copy>
      <View style={local.scale}>
        {Array.from({ length: 10 }, (_, index) => index + 1).map(value => <Radio key={value} cell label={`Morning energy: ${value}`} text={String(value)} selected={score === value} disabled={false} onPress={() => { setScore(value); if (step === 2) setStep(3); }} />)}
      </View>
    </View>}
    {step === 3 && <StickyAction>
      <Copy style={ui.hint}>Example only. Nothing is saved.</Copy>
      <Action wide label="Save example" onPress={finish} />
    </StickyAction>}
  </View>;
}

const useLocal = themedStyles(COLORS => StyleSheet.create({
  top: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  step: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  mark: { padding: SPACING.md, borderRadius: RADII.control, color: COLORS.text, backgroundColor: COLORS['accent-tint'] },
  part: { gap: SPACING.sm, padding: SPACING.sm, borderRadius: RADII.card, borderWidth: LAYOUT.focusWidth, borderColor: 'transparent' },
  current: { borderColor: COLORS.accent },
  pair: { flexDirection: 'row', gap: SPACING.sm },
  half: { flex: 1 },
  scale: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
}));
