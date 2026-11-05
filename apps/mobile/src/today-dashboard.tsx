import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { FONT_FAMILIES, LAYOUT, MOTION_DURATION_MS, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import type { DayData } from './today';
import { displayDayTime, isLastBaselineDay, testStartWhen } from './lib/experiments';
import { allDaysDone } from './finish';
import { Action, Copy, ForwardLink, Title, useScreenEnter } from './ui';
import { themedStyles, useColors, useTheme } from './theme-core';

export function greeting(now: Date, name?: string) {
  const hour = now.getHours();
  const period = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'evening';
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${period[0].toUpperCase()}${period.slice(1)}, ${first}.` : `Good ${period}.`;
}
/** Presentation of server day states only: no dates or experiment days are calculated here. */
export function weeklyCount({ timeline }: DayData) {
  const current = timeline.progress.day_number;
  if (current === null || timeline.progress.state !== 'in_progress') return null;
  return timeline.days.filter(day => day.day_number <= current && day.day_number > current - 7 && day.state === 'recorded').length;
}
const closesAt = ({ timeline }: DayData) => timeline.next_day_at ?? (timeline.progress.day_number === timeline.progress.total_days ? timeline.progress.ends_at : null);
const deadline = (entry: DayData) => { const close = closesAt(entry); return close ? Date.parse(close) : Number.POSITIVE_INFINITY; };
const recorded = ({ timeline }: DayData) => timeline.days.some(day => day.day_number === timeline.progress.day_number && day.state === 'recorded');
function priority(entry: DayData) {
  if (entry.timeline.progress.state === 'in_progress' && !recorded(entry)) return 0;
  if (recorded(entry) && isLastBaselineDay(entry.timeline)) return 1;
  if (entry.timeline.progress.state === 'completed' || allDaysDone(entry.timeline)) return 2;
  return 3;
}
function CardLink({ label, onPress, children, testID, hint, disabled = false }: { label: string; onPress: () => void; children: ReactNode; testID?: string; hint?: string; disabled?: boolean }) {
  const local = useLocal(); const reduce = useReducedMotion(); const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return <Animated.View style={style}><Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} disabled={disabled} accessibilityState={{ disabled }}
    onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
    onPressIn={() => { if (!reduce) scale.set(withTiming(0.98, { duration: MOTION_DURATION_MS.press, reduceMotion: ReduceMotion.System })); }}
    onPressOut={() => { if (!reduce) scale.set(withTiming(1, { duration: MOTION_DURATION_MS.press, reduceMotion: ReduceMotion.System })); }} style={local.link}>{children}<Copy>→</Copy></Pressable></Animated.View>;
}
/** Seven fixed SVG segments fill once through opacity only; no SVG geometry or layout animates. */
function WeeklySegment({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const colors = useColors();
  const style = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, progress.get() - index)) }));
  const length = 2 * Math.PI * 19;
  return <Animated.View style={[StyleSheet.absoluteFill, style]}><Svg width={48} height={48}>
    <Circle cx={24} cy={24} r={19} stroke={colors.moss} strokeWidth={SPACING.xs} fill="none"
      strokeDasharray={[length / 7 - 1, length]} rotation={-90 + index * 360 / 7} origin="24,24" />
  </Svg></Animated.View>;
}
function WeeklyRing({ count }: { count: number | null }) {
  const colors = useColors(); const local = useLocal(); const reduce = useReducedMotion();
  const target = count ?? 0;
  const progress = useSharedValue(reduce ? target : 0);
  useEffect(() => { progress.set(reduce ? target : withTiming(target, { duration: MOTION_DURATION_MS.response, reduceMotion: ReduceMotion.System })); }, [progress, target, reduce]);
  return <View style={local.week} accessible accessibilityLabel={count === null ? 'Weekly check-ins unavailable' : `${count} of 7 days recorded in this experiment’s last seven days`}>
    <View style={local.ring}>
      <Svg width={48} height={48}><Circle cx={24} cy={24} r={19} stroke={colors.line} strokeWidth={SPACING.xs} fill="none" /></Svg>
      {Array.from({ length: 7 }, (_, index) => <WeeklySegment key={index} index={index} progress={progress} />)}
      <View style={local.ringLabel}><Copy style={local.caption}>{count === null ? '—/7' : `${count}/7`}</Copy></View>
    </View><Copy style={local.caption}>last 7 days</Copy><Copy style={local.caption}>{count === null ? 'not available' : 'this experiment'}</Copy>
  </View>;
}
function TodayScene({ entry, evening }: { entry?: DayData; evening: boolean }) {
  const colors = useColors(); const local = useLocal(); const { scheme } = useTheme();
  const sky = colors[scheme === 'dark' ? 'night-tint' : 'chart-band'];
  const day = entry?.timeline.progress.day_number;
  const total = entry?.timeline.progress.total_days;
  const angle = day && total ? (day - 1) / total * 2 * Math.PI : 0;
  const x = 180 + 36 * Math.sin(angle), y = 66 - 36 * Math.cos(angle);
  return <View style={local.scene} accessible accessibilityRole="image" accessibilityLabel={entry
    ? `Rhythm ring, ${day === null ? entry.timeline.progress.state.replace('_', ' ') : `day ${day} of ${total}`}. ${entry.timeline.days.filter(item => item.state === 'recorded').length} recorded, ${entry.timeline.days.filter(item => item.state === 'missed').length} missed.`
    : `${evening ? 'A moon' : 'A sun'} on the rhythm ring, ready for your first experiment.`}>
    <Svg width="100%" height="100%" viewBox="0 0 360 132" preserveAspectRatio="xMidYMid slice">
      <Rect width={360} height={132} fill={sky} />
      <Ellipse cx={65} cy={164} rx={190} ry={72} fill={colors['chart-2']} opacity={0.25} />
      <Ellipse cx={320} cy={180} rx={220} ry={85} fill={colors.moss} opacity={0.18} />
      <Circle cx={180} cy={66} r={36} stroke={colors.moss} strokeOpacity={0.35} strokeWidth={SPACING.xs} fill="none" />
      {entry?.timeline.days.map(item => { const a = (item.day_number - 1) / entry.timeline.progress.total_days * Math.PI * 2; const px = 180 + 36 * Math.sin(a), py = 66 - 36 * Math.cos(a); return item.state === 'missed'
        ? <Path key={item.day_number} d={`M ${px - 3} ${py - 3} l 6 6 m -6 0 l 6 -6`} stroke={colors.text} strokeWidth={LAYOUT.focusWidth} />
        : <Circle key={item.day_number} cx={px} cy={py} r={3} fill={item.state === 'recorded' ? colors.moss : sky} stroke={colors.moss} />; })}
      <Circle opacity={entry && day === null ? 0 : 1} cx={x} cy={y} r={11} fill={colors.marker} stroke={colors.text} strokeWidth={LAYOUT.focusWidth / 2} />
      {evening && (!entry || day !== null) && <Circle cx={x + 5} cy={y - 4} r={9} fill={sky} />}
    </Svg>
  </View>;
}
export function TodayDashboard({ entries, disabled, onCheckin, onDetail, onResults, onAsk, onExample, renderResults, now = new Date() }: {
  entries: DayData[]; disabled: boolean; onCheckin: (entry: DayData) => void; onDetail: (entry: DayData) => void; onResults: (entry: DayData) => void; onAsk: () => void; onExample: () => void; now?: Date; renderResults?: (entry: DayData) => ReactNode;
}) {
  const local = useLocal(); useScreenEnter('today-dashboard');
  const sorted = [...entries].sort((a, b) => priority(a) - priority(b) || (deadline(a) === deadline(b) ? 0 : deadline(a) - deadline(b)));
  const hero = sorted[0]; const p = hero?.timeline.progress;
  const due = sorted.find(entry => priority(entry) < 2 || entry.timeline.progress.state === 'completed');
  const dueClose = due ? closesAt(due) : null;
  const dueTitle = due && priority(due) === 0 ? `Check-in due${dueClose ? ` · closes ${displayDayTime(dueClose)}` : ''}`
    : due && priority(due) === 1 ? `Baseline done · your test starts ${testStartWhen(due.timeline.next_day_at, now)}`
    : due?.timeline.progress.state === 'completed' ? 'Your results are ready' : null;
  const results = Boolean(hero && (p?.state === 'completed' || allDaysDone(hero.timeline)) && !hero.experiment.is_seeded);
  const label = results ? 'See your results' : p?.state === 'not_started' ? 'Check-in not open' : hero?.experiment.is_seeded && p?.state !== 'in_progress' ? 'See example details' : hero && recorded(hero) ? "Edit today's answers" : 'Check in now';
  return <View style={local.page}>
    <View style={local.header}><View style={local.greeting}><Copy style={local.caption}>{`${now.toLocaleDateString('en-GB', { weekday: 'long' })}, ${now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`}</Copy><Title>{greeting(now)}</Title></View><WeeklyRing count={hero ? weeklyCount(hero) : null} /></View>
    {due && dueTitle && <View style={local.due}><CardLink label={dueTitle} disabled={disabled} onPress={() => due.timeline.progress.state === 'completed' ? onResults(due) : onDetail(due)}><View style={local.greeting}><Copy style={local.dueTitle}>{dueTitle}</Copy><Copy style={local.caption}>{priority(due) === 0 ? 'A short check-in, whenever you’re ready.' : priority(due) === 1 ? 'Keep your routine until the test opens.' : 'Compare your prediction with your observations.'}</Copy></View></CardLink></View>}
    <View style={local.hero}>
      <View style={local.heroCopy}><Copy style={local.caption}>Up next{hero?.experiment.is_seeded ? ' · Example experiment' : ''}</Copy>
        {hero ? <CardLink label="See your experiment" hint={hero.experiment.question} onPress={() => onDetail(hero)}><View style={local.greeting}><Copy numberOfLines={2} accessibilityRole="header" accessibilityLabel={hero.experiment.question} style={local.heroTitle}>{hero.experiment.question}</Copy></View></CardLink> : <Title small>Ask your first question</Title>}
        {hero && <><Copy style={local.caption}>{p?.day_number === null ? p.state === 'completed' ? 'Completed' : p.state === 'ended' ? 'All days done' : 'Not started' : <><Text>{`Day ${p?.day_number} of ${p?.total_days}`}</Text>{` · ${p?.phase === 'baseline' ? 'Baseline' : 'Test'}`}</>}</Copy>{recorded(hero) && <Copy style={local.caption}>{`Day ${p?.day_number} recorded`}</Copy>}<Copy numberOfLines={1} accessibilityLabel={`Small change: ${hero.experiment.intervention.action}`}>“<Text>{hero.experiment.intervention.action}</Text>”</Copy></>}
        {!hero && <Copy>Turn a habit question into a small personal experiment.</Copy>}
      </View>
      <TodayScene entry={hero} evening={now.getHours() >= 18 || now.getHours() < 5} />
      <View style={local.heroCopy}>{hero ? results && renderResults ? renderResults(hero) : <Action haptic wide label={label} name={label === 'Check in now' && p?.state === 'in_progress' ? `Check in now, day ${p?.day_number}` : label} disabled={disabled || p?.state === 'not_started'} onPress={() => { if (results) onResults(hero); else if (hero.experiment.is_seeded && p?.state !== 'in_progress') onDetail(hero); else onCheckin(hero); }} /> : <Action haptic wide label="Ask your first question" onPress={onAsk} />}</View>
    </View>
    {sorted.length > 1 && <View><Copy style={local.caption}>Also running</Copy>{sorted.slice(1).map(entry => <CardLink key={entry.experiment.id} testID={`also-${entry.experiment.id}`} label={`Open ${entry.experiment.question}`} onPress={() => onDetail(entry)}><View style={local.greeting}><Copy numberOfLines={1} accessibilityLabel={entry.experiment.question}>{entry.experiment.is_seeded ? 'Example · ' : ''}{entry.experiment.question}</Copy><Copy style={local.caption}>{entry.timeline.progress.day_number === null ? entry.timeline.progress.state : `Day ${entry.timeline.progress.day_number} of ${entry.timeline.progress.total_days}`}</Copy></View></CardLink>)}</View>}
    {!hero && <ForwardLink label="See a completed example" onPress={onExample} />}
  </View>;
}
const useLocal = themedStyles(colors => StyleSheet.create({
  page: { gap: SPACING.sm + SPACING.xs, marginTop: -SPACING.lg }, header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }, greeting: { flex: 1, gap: SPACING.xs },
  caption: { ...NATIVE_TYPOGRAPHY.caption, color: colors.muted }, week: { alignItems: 'center' }, ring: { width: 48, height: 48 }, ringLabel: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  due: { backgroundColor: colors['moss-tint'], borderRadius: RADII.card, paddingHorizontal: SPACING.md }, dueTitle: { ...NATIVE_TYPOGRAPHY.caption, color: colors.text },
  link: { minHeight: LAYOUT.primaryAction, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm },
  hero: { backgroundColor: colors.paper, borderRadius: RADII.card, overflow: 'hidden', borderWidth: LAYOUT.focusWidth / 2, borderColor: colors.line },
  heroCopy: { padding: SPACING.sm + SPACING.xs, gap: SPACING.xs }, heroTitle: { ...NATIVE_TYPOGRAPHY.title, fontFamily: FONT_FAMILIES.display }, scene: { height: LAYOUT.primaryAction * 2 },
}));
