import { StyleSheet, View } from 'react-native';
import { COLORS, FONT_FAMILIES, LAYOUT, NATIVE_TYPOGRAPHY, SPACING } from '@rhythm-health/brand';
import { Action, Copy, styles, useStepFocus } from './ui';

const SCENES = [
  { time: '22:30 · Night', title: 'Your sleep is the experiment.', body: 'Ask one habit question. Rhythm turns it into a small experiment that changes one thing at a time, so you can tell what made the difference.' },
  { time: '07:00 · Morning', title: 'Check in in about 30 seconds.', body: 'How did you sleep? How is your energy? Did you make the change? A few quick answers each morning, and the day is recorded.' },
  { time: '12:30 · Noon', title: 'The prediction comes first.', body: 'Before day one, Rhythm writes down what it expects, like “morning energy +8–15%”. It’s a range, not a promise, and it can’t change once you start.' },
  { time: '17:30 · Evening', title: 'Late coffee, or none after 2 PM?', body: 'Every experiment compares 3 normal days with 7 days of one small change. You live your day as usual; Rhythm keeps the evidence.' },
  { time: '20:00 · Night again', title: 'Does a walk after dinner help you sleep?', body: 'At the end, your Lab Report puts the prediction next to what actually happened, and says honestly whether it looks like a likely signal or just noise.' },
  { time: '22:30 · Night', title: 'Tomorrow is day 4.', body: 'One small check-in a day adds up to an answer about you, not about people in general.' },
];
const STEPS = [
  { title: 'Tell us your rhythm', body: 'When you sleep, how much you move, and the habits you already have. About a minute.' },
  { title: 'Get a prediction, then test it', body: 'We design one small experiment and say what we expect to change. You record 3 normal days, then 7 test days. Each check-in takes about 30 seconds.' },
  { title: 'See what actually happened', body: 'Your lab report puts the prediction next to your own results, and says so when a change is just noise.' },
];
const QUESTIONS = ['Does walking after dinner improve my sleep?', 'Does less caffeine improve my focus?', 'Does waking earlier actually make me more productive?'];

/**
 * The web's public page, as text. The scrolling day illustration stays web-only; the scenes read like
 * the web's reduced-motion version, without the stills.
 */
export function Landing({ onStart }: { onStart: () => void }) {
  const heading = useStepFocus('landing');
  const start = <View style={styles.stack}>
    <Action label="Run your first experiment" onPress={onStart} />
    <Copy style={local.small}>About a minute to set up.</Copy>
  </View>;
  return <View style={local.page}>
    <View style={styles.stack}>
      <Copy ref={heading} accessibilityRole="header" style={styles.title}>{'Stop guessing what works for you.\n'}<Copy style={[styles.title, { color: COLORS.muted }]}>Test it.</Copy></Copy>
      <Copy style={[styles.muted, NATIVE_TYPOGRAPHY.lead]}>Turn a habit question into a small personal experiment. Record your usual routine, test one change, then compare the forecast with what you observed.</Copy>
      {start}
    </View>
    {SCENES.map(scene => <View key={scene.title} style={styles.divider}>
      <Copy style={local.number}>{scene.time}</Copy>
      <Copy accessibilityRole="header" style={local.headline}>{scene.title}</Copy>
      <Copy style={[styles.muted, NATIVE_TYPOGRAPHY.lead]}>{scene.body}</Copy>
    </View>)}
    <View style={styles.divider}>
      <Copy accessibilityRole="header" style={local.headline}>How it works</Copy>
      {STEPS.map((step, index) => <View key={step.title} style={local.step}>
        <Copy accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={local.number}>{`0${index + 1}`}</Copy>
        <Copy accessibilityRole="header" style={styles.sectionTitle}>{step.title}</Copy>
        <Copy style={styles.muted}>{step.body}</Copy>
      </View>)}
    </View>
    <View style={styles.divider}>
      <Copy accessibilityRole="header" style={local.headline}>A question worth testing.</Copy>
      {QUESTIONS.map((question, index) => <View key={question} style={local.question}>
        <Copy accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={local.number}>{`0${index + 1}`}</Copy>
        <Copy style={local.questionText}>{question}</Copy>
      </View>)}
    </View>
    <View style={styles.divider}>
      <Copy accessibilityRole="header" style={local.headline}>Your first question takes about a minute to set up.</Copy>
      {start}
    </View>
  </View>;
}

const local = StyleSheet.create({
  page: { gap: SPACING.xl },
  small: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  number: { ...styles.number, ...NATIVE_TYPOGRAPHY.caption },
  headline: { fontFamily: FONT_FAMILIES.display, ...NATIVE_TYPOGRAPHY.headline, color: COLORS.ink },
  step: { gap: SPACING.xs, paddingTop: SPACING.sm },
  question: { flexDirection: 'row', gap: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line },
  questionText: { flex: 1, fontFamily: FONT_FAMILIES.display, ...NATIVE_TYPOGRAPHY.title },
});
