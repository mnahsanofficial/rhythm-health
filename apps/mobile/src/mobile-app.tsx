import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Linking, Platform, TextInput, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@rhythm-health/contract';
import { FONT_FAMILIES } from '@rhythm-health/brand';
import { useFonts } from 'expo-font';
import { useNetworkState } from 'expo-network';
import { Fraunces_400Regular } from '@expo-google-fonts/fraunces/400Regular';
import { InstrumentSans_400Regular } from '@expo-google-fonts/instrument-sans/400Regular';
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono/400Regular';
import { readConfig } from './lib/config';
import { createAuthClient } from './lib/supabase';
import { ApiError, getProfile } from './lib/profile';
import { Action, Alert, Copy, Frame, Loading, styles, Title } from './ui';

const fontAssets = {
  [FONT_FAMILIES.display]: Fraunces_400Regular,
  [FONT_FAMILIES.sans]: InstrumentSans_400Regular,
  [FONT_FAMILIES.mono]: GeistMono_400Regular,
};

export function MobileApp() {
  const [attempt, setAttempt] = useState(0);
  return <FontGate key={attempt} retry={() => setAttempt(n => n + 1)} />;
}
function FontGate({ retry }: { retry: () => void }) {
  const [loaded, error] = useFonts(fontAssets);
  if (error) return <Frame><Alert>Couldn&apos;t open Rhythm.</Alert><Action label="Try again" onPress={retry} /></Frame>;
  if (!loaded) return <Frame><Loading message="Opening Rhythm…" /></Frame>;
  let config: ReturnType<typeof readConfig>;
  try { config = readConfig(); }
  catch (cause) { return <Frame><Title>A little setup first.</Title><Alert>{(cause as Error).message}</Alert></Frame>; }
  return <SessionGate config={config} />;
}

type ProfileState = { kind: 'loading' } | { kind: 'ready'; profile: Profile | null } | { kind: 'error'; message: string };
function SessionGate({ config }: { config: ReturnType<typeof readConfig> }) {
  const { supabaseUrl, anonKey } = config;
  const client = useMemo(() => createAuthClient({ supabaseUrl, anonKey }), [supabaseUrl, anonKey]);
  const network = useNetworkState();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [authFailure, setAuthFailure] = useState<'restore' | 'signout' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileState>({ kind: 'loading' });
  const [profileAttempt, setProfileAttempt] = useState(0);
  const [authAttempt, setAuthAttempt] = useState(0);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { data } = client.auth.onAuthStateChange((_event, current) => {
      if (!cancelled) { setSession(current); setReady(true); }
    });
    client.auth.getSession().then(({ data, error }) => {
      if (cancelled) return;
      if (error) setAuthFailure('restore'); else setSession(data.session);
      setReady(true);
    }).catch(() => { if (!cancelled) { setAuthFailure('restore'); setReady(true); } });
    const refresh = () => {
      if (AppState.currentState === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    };
    refresh();
    const subscription = AppState.addEventListener('change', refresh);
    return () => { cancelled = true; data.subscription.unsubscribe(); subscription.remove(); client.auth.stopAutoRefresh(); };
  }, [client, authAttempt]);

  const token = session?.access_token;
  useEffect(() => {
    if (!token || offline) return;
    let cancelled = false;
    getProfile(token).then(value => {
      if (!cancelled) setProfile({ kind: 'ready', profile: value });
    }).catch((cause: unknown) => {
      if (cancelled) return;
      if (cause instanceof ApiError && cause.status === 401) {
        void signOut('Your session has expired. Sign in again.');
      } else setProfile({ kind: 'error', message: cause instanceof Error ? cause.message : "Couldn't load your profile. Try again." });
    });
    return () => { cancelled = true; };
    // The only request identity is the token. Retry is explicit; callbacks aren't dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, offline, profileAttempt]);

  async function signOut(reason: string | null = null) {
    setSession(null); setProfile({ kind: 'loading' }); setMessage(reason); setAuthFailure(null);
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch { setAuthFailure('signout'); }
  }
  function openWeb(path: string) {
    setLinkError(null);
    void Linking.openURL(new URL(path, config.webUrl).toString()).catch(() => setLinkError("Couldn't open the web app. Try again."));
  }
  const retry = () => { setReady(false); setAuthFailure(null); setProfile({ kind: 'loading' }); setAuthAttempt(n => n + 1); };

  return (
    <Frame>
      {authFailure ? <>
        <Alert>{authFailure === 'restore' ? "Couldn't restore your saved session." : "Couldn't remove your saved session."} Try again.</Alert>
        <Action label="Try again" onPress={authFailure === 'signout' ? () => void signOut(message) : retry} />
      </> : !ready ? <Loading message="Opening your rhythm…" /> : !session ? <SignIn
        offline={offline} message={message}
        signIn={async (email, password) => {
          const { data, error } = await client.auth.signInWithPassword({ email, password });
          if (error) throw error;
          setProfile({ kind: 'loading' }); setMessage(null); setSession(data.session);
        }}
        openWeb={() => openWeb('/onboarding')}
      /> : <>
        {offline ? <><Title>No connection</Title><Copy>Your saved session is here. Reconnect to load your profile.</Copy></>
          : profile.kind === 'loading' ? <Loading message="Loading your profile…" />
          : profile.kind === 'error' ? <><Alert>{profile.message}</Alert><Action label="Try again" onPress={() => { setProfile({ kind: 'loading' }); setProfileAttempt(n => n + 1); }} /></>
          : profile.profile === null ? <>
            <Title>Finish setting up on the web</Title>
            <Copy style={styles.muted}>Your account is ready. Add your rhythm on the web before checking in here.</Copy>
            <Action label="Set up your rhythm on the web" link onPress={() => openWeb('/onboarding')} />
          </> : <>
            <Title>Your rhythm is ready.</Title>
            {profile.profile.goals.length > 0 && <View style={styles.stack}><Copy style={styles.muted}>Your focus</Copy>{profile.profile.goals.map(goal => <Copy key={goal}>{goal}</Copy>)}</View>}
            <Action label="Open your lab on the web" link onPress={() => openWeb('/')} />
          </>}
        <View style={styles.divider}>
          <Copy style={styles.muted}>{session.user.email}</Copy>
          <Action label="Sign out" secondary onPress={() => void signOut()} />
        </View>
      </>}
      {linkError && <Alert>{linkError}</Alert>}
    </Frame>
  );
}

function SignIn({ offline, message, signIn, openWeb }: {
  offline: boolean; message: string | null;
  signIn: (email: string, password: string) => Promise<void>; openWeb: () => void;
}) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length > 0;
  async function submit() {
    if (sending.current || offline || !valid) return;
    sending.current = true; setBusy(true); setError(null);
    try { await signIn(email.trim(), password); }
    catch (cause) {
      const status = (cause as { status?: number }).status;
      setError(status === 400 || status === 401 || status === 422
        ? "Email or password wasn't recognised. Try again." : "Couldn't reach sign-in. Try again.");
    } finally { sending.current = false; setBusy(false); }
  }
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.stack}>
        <Title>Welcome back.</Title>
        <Copy style={styles.muted}>Sign in to keep up with your daily experiment.</Copy>
        {offline && <Alert>No connection</Alert>}
        {(error || message) && <Alert>{error || message}</Alert>}
        <View>
          <Copy style={styles.label}>Email</Copy>
          <TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} keyboardType="email-address"
            autoComplete="email" textContentType="emailAddress" autoCapitalize="none" autoCorrect={false}
            onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
            style={[styles.input, focused === 'email' && styles.focus]} editable={!busy} />
        </View>
        <View>
          <Copy style={styles.label}>Password</Copy>
          <TextInput accessibilityLabel="Password" value={password} onChangeText={setPassword} secureTextEntry
            autoComplete="current-password" textContentType="password" autoCapitalize="none"
            onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
            style={[styles.input, focused === 'password' && styles.focus]} editable={!busy}
            returnKeyType="go" onSubmitEditing={() => void submit()} />
        </View>
        <Action label={busy ? 'Signing in…' : 'Sign in'} onPress={() => void submit()} disabled={!valid || busy || offline} />
        <View style={styles.divider}>
          <Copy style={styles.muted}>New here? Set up your rhythm on the web first.</Copy>
          <Action label="Set up your rhythm on the web" onPress={openWeb} secondary link />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
