import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { Calibration } from '@rhythm-health/contract';
import { ApiError } from './lib/api';
import { getCalibration } from './lib/history';
import { signedPercent } from './lib/proposals';
import { Action, Alert, Copy, Status, useStyles } from './ui';

const TREND = {
  closer: 'Your guesses are getting closer.',
  further: 'Your recent guesses were further off.',
  steady: 'Your guesses are staying about as close.',
} as const;

const points = (value: number) => `${value} ${value === 1 ? 'point' : 'points'}`;

/** Own guess against what happened. The backend works out every number here, with no AI call. */
export function CalibrationCard({ token, offline, onExpired }: { token: string; offline: boolean; onExpired: () => void }) {
  const ui = useStyles();
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (offline) return;
    let active = true;
    getCalibration(token).then(result => {
      if (active) { setCalibration(result); setError(null); }
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) onExpired();
      else setError(cause instanceof Error ? cause.message : "Couldn't load this. Try again.");
    });
    return () => { active = false; };
    // A refreshed token is not a reason to read again; `attempt` is the explicit retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline, attempt]);

  // Nothing was read, and History already says it's offline.
  if (offline && !calibration) return null;
  const guesses = calibration?.points ?? [];
  return <View style={ui.divider}>
        {error ? <>
      <Alert>{error}</Alert>
      <Action label="Try again" name="Try again for your guesses" secondary disabled={offline} onPress={() => { setError(null); setAttempt(n => n + 1); }} />
    </> : !calibration ? <Status style={ui.muted}>Checking your guesses…</Status>
      : guesses.length === 0 ? <>
        <Copy>Your next experiment asks for your own guess before the forecast, so you can see how close you get.</Copy>
        {calibration.example && <View testID="calibration-example" accessible={false} accessibilityLabel="Example, not your results" style={ui.stack}>
          <Copy style={ui.sectionTitle}>Example</Copy>
          <Copy>Built from invented check-ins and an invented guess. It isn&apos;t part of your results.</Copy>
          <Copy>{calibration.example.question}</Copy>
          <Copy style={ui.muted}>{`Guessed ${signedPercent(calibration.example.guessed_change_percent)} · It changed ${signedPercent(calibration.example.observed_change_percent)} · ${points(calibration.example.off_by_points)} away`}</Copy>
        </View>}
      </>
        : <>
          <Copy>{calibration.trend ? TREND[calibration.trend] : "Finish another experiment to see whether you're getting closer."}</Copy>
          {calibration.trend && calibration.average_off_by_points !== null && <Copy>
            {`${points(calibration.average_off_by_points)} away on average across ${guesses.length} experiments. A few short experiments show a pattern, not proof.`}
          </Copy>}
          {[...guesses].reverse().map(guess => <View key={guess.experiment_id} testID="calibration-point" style={ui.stack}>
            <Copy>{guess.question}</Copy>
            <Copy style={ui.muted}>{`You guessed ${signedPercent(guess.guessed_change_percent)} · It changed ${signedPercent(guess.observed_change_percent)} · ${points(guess.off_by_points)} away`}</Copy>
          </View>)}
        </>}
  </View>;
}
