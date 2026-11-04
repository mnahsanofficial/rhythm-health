import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { FONT_FAMILIES, LAYOUT, NATIVE_TYPOGRAPHY, SPACING } from '@rhythm-health/brand';
import { Action, Alert, Copy, useStyles, Title, Status } from './ui';
import { useNavScreen } from './nav';
import { themedStyles, useColors } from './theme-core';

/** An open eye while the password is hidden; crossed out once it is shown. The same drawing as the web's. */
function EyeIcon({ crossed }: { crossed: boolean }) { const COLORS = useColors();
  const stroke = { stroke: COLORS.muted, strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return <Svg width={SPACING.lg - SPACING.xs} height={SPACING.lg - SPACING.xs} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" {...stroke} />
    <Circle cx={12} cy={12} r={3} {...stroke} />
    {crossed && <Path d="M4 4l16 16" {...stroke} />}
  </Svg>;
}

export function AuthForm({ offline, message, initialMode = 'signIn', onBack, authenticate }: {
  offline: boolean; message: string | null; initialMode?: 'signIn' | 'signUp'; onBack?: () => void;
  authenticate: (mode: 'signIn' | 'signUp', email: string, password: string) => Promise<boolean>;
}) { const styles = useStyles(); const local = useLocal();
  const [mode, setMode] = useState<'signIn' | 'signUp'>(initialMode);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false); const [focused, setFocused] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const sending = useRef(false);
  useNavScreen(onBack ? { kind: 'flow', onBack, busy } : null);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length >= 6;
  async function submit() {
    if (sending.current || offline || !valid) return;
    sending.current = true; setBusy(true); setError(null); setConfirmation(null);
    try {
      if (!await authenticate(mode, email.trim(), password)) {
        setConfirmation(`We've sent a link to ${email.trim()}. Open it to confirm your account, then sign in here.`);
        setPassword(''); setShown(false); setMode('signIn');
      }
    } catch (cause) {
      const status = (cause as { status?: number }).status;
      setError(cause instanceof Error && cause.message ? cause.message
        : typeof (cause as { message?: unknown }).message === 'string' ? (cause as { message: string }).message
        : status === 400 || status === 401 || status === 422 ? "Email or password wasn't recognised. Try again."
        : "Can't reach the sign-in service. Check your connection and try again.");
    } finally { sending.current = false; setBusy(false); }
  }
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.stack}>
      <Title>{mode === 'signIn' ? 'Welcome back.' : 'Create an account.'}</Title>
      <Copy style={styles.muted}>{mode === 'signIn' ? 'Sign in to keep up with your daily experiment.' : 'Your experiments start from your rhythm. Seven quick questions come next.'}</Copy>
      {offline && <Alert>No connection</Alert>}
      {(error || message) && <Alert>{error || message}</Alert>}
      {confirmation && <Status>{confirmation}</Status>}
      <View><Copy style={styles.label}>Email</Copy>
        <TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} keyboardType="email-address"
          autoComplete="email" textContentType="emailAddress" autoCapitalize="none" autoCorrect={false}
          onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
          style={[styles.input, focused === 'email' && styles.focus]} editable={!busy} />
      </View>
      <View><Copy style={styles.label}>Password</Copy>
        <View><TextInput accessibilityLabel="Password" value={password} onChangeText={setPassword} secureTextEntry={!shown}
          autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'} textContentType={mode === 'signIn' ? 'password' : 'newPassword'} autoCapitalize="none"
          onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
          style={[styles.input, local.password, focused === 'password' && styles.focus]} editable={!busy}
          returnKeyType="go" onSubmitEditing={() => void submit()} />
        <Pressable accessibilityRole="button" accessibilityLabel={shown ? 'Hide password' : 'Show password'} accessibilityState={{ selected: shown, disabled: busy }} disabled={busy}
          onPress={() => setShown(v => !v)} style={({ pressed }) => [local.eye, pressed && { opacity: 0.6 }]}><EyeIcon crossed={shown} /></Pressable></View>
        {mode === 'signUp' && <Copy style={local.hint}>At least 6 characters.</Copy>}
      </View>
      <Action label={busy ? mode === 'signIn' ? 'Signing in…' : 'Creating your account…' : mode === 'signIn' ? 'Sign in' : 'Create account'} onPress={() => void submit()} disabled={!valid || busy || offline} wide testID="submit-action" />
      <View style={local.switch}>
        <Copy style={styles.muted}>{mode === 'signIn' ? 'New here?' : 'Already have an account?'}</Copy>
        <Pressable accessibilityRole="link" accessibilityLabel={mode === 'signIn' ? 'Create an account' : 'Sign in'} accessibilityState={{ disabled: busy }} disabled={busy} style={({ pressed }) => [local.switchLink, pressed && { opacity: 0.6 }]} onPress={() => {
          setMode(mode === 'signIn' ? 'signUp' : 'signIn'); setPassword(''); setShown(false); setError(null); setConfirmation(null);
        }}><Copy style={local.switchText}>{mode === 'signIn' ? 'Create an account' : 'Sign in'}</Copy></Pressable>
      </View>
    </View>
  </KeyboardAvoidingView>;
}

const useLocal = themedStyles(COLORS => StyleSheet.create({
  password: { paddingRight: LAYOUT.primaryAction },
  eye: { position: 'absolute', right: 0, top: 0, bottom: 0, minWidth: LAYOUT.primaryAction, minHeight: LAYOUT.primaryAction, alignItems: 'center', justifyContent: 'center' },
  hint: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted, marginTop: SPACING.sm },
  switch: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: SPACING.xs },
  switchLink: { minHeight: LAYOUT.primaryAction, justifyContent: 'center' },
  switchText: { fontFamily: FONT_FAMILIES.sansMedium, color: COLORS.moss },
}));
