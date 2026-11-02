import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { Action, Alert, Copy, styles, Title } from './ui';

export function AuthForm({ offline, message, authenticate }: {
  offline: boolean; message: string | null;
  authenticate: (mode: 'signIn' | 'signUp', email: string, password: string) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false); const [focused, setFocused] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const sending = useRef(false);
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
      {confirmation && <Copy accessibilityLiveRegion="polite">{confirmation}</Copy>}
      <View><Copy style={styles.label}>Email</Copy>
        <TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} keyboardType="email-address"
          autoComplete="email" textContentType="emailAddress" autoCapitalize="none" autoCorrect={false}
          onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
          style={[styles.input, focused === 'email' && styles.focus]} editable={!busy} />
      </View>
      <View><Copy style={styles.label}>Password</Copy>
        <TextInput accessibilityLabel="Password" value={password} onChangeText={setPassword} secureTextEntry={!shown}
          autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'} textContentType={mode === 'signIn' ? 'password' : 'newPassword'} autoCapitalize="none"
          onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
          style={[styles.input, focused === 'password' && styles.focus]} editable={!busy}
          returnKeyType="go" onSubmitEditing={() => void submit()} />
        <Action label={shown ? 'Hide password' : 'Show password'} secondary disabled={busy} onPress={() => setShown(v => !v)} />
      </View>
      <Action label={busy ? mode === 'signIn' ? 'Signing in…' : 'Creating your account…' : mode === 'signIn' ? 'Sign in' : 'Create account'} onPress={() => void submit()} disabled={!valid || busy || offline} />
      <View style={styles.divider}>
        <Copy style={styles.muted}>{mode === 'signIn' ? 'New here?' : 'Already have an account?'}</Copy>
        <Action label={mode === 'signIn' ? 'Create an account' : 'Sign in'} disabled={busy} secondary onPress={() => {
          setMode(mode === 'signIn' ? 'signUp' : 'signIn'); setPassword(''); setShown(false); setError(null); setConfirmation(null);
        }} />
      </View>
    </View>
  </KeyboardAvoidingView>;
}
