import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@rhythm-health/contract';
import { FONT_FAMILIES } from '@rhythm-health/brand';
import { useFonts } from 'expo-font';
import { useNetworkState } from 'expo-network';
import { Fraunces_400Regular } from '@expo-google-fonts/fraunces/400Regular';
import { InstrumentSans_400Regular } from '@expo-google-fonts/instrument-sans/400Regular';
import { InstrumentSans_500Medium } from '@expo-google-fonts/instrument-sans/500Medium';
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono/400Regular';
import { AppHeader, type Section } from './app-header';
import { NavProvider } from './nav';
import { TabBar } from './tab-bar';
import { ReminderProvider, useReminders } from './reminder-context';
import { ReminderNotice } from './settings';
import { Today } from './today';
import { AuthForm } from './auth-form';
import { Landing } from './landing';
import { Onboarding } from './onboarding';
import { FirstRunGuide, firstRunSeen } from './first-run-guide';
import { clearDraft } from './lib/onboarding';
import { readConfig } from './lib/config';
import { createAuthClient } from './lib/supabase';
import { ApiError, getProfile } from './lib/profile';
import { Action, Alert, Copy, Frame, Loading, Title } from './ui';

const fontAssets = {
  [FONT_FAMILIES.display]: Fraunces_400Regular,
  [FONT_FAMILIES.sans]: InstrumentSans_400Regular,
  [FONT_FAMILIES.sansMedium]: InstrumentSans_500Medium,
  [FONT_FAMILIES.mono]: GeistMono_400Regular,
};

export function MobileApp() {
  const [attempt, setAttempt] = useState(0);
  return <ReminderProvider><FontGate key={attempt} retry={() => setAttempt(n => n + 1)} /></ReminderProvider>;
}
function FontGate({ retry }: { retry: () => void }) {
  const [loaded, error] = useFonts(fontAssets);
  if (error) return <Frame fontsReady={false} header={<AppHeader />}><Alert>Couldn&apos;t open Rhythm.</Alert><Action label="Try again" onPress={retry} /></Frame>;
  if (!loaded) return <Frame fontsReady={false} header={<AppHeader />}><Loading message="Opening Rhythm…" /></Frame>;
  let config: ReturnType<typeof readConfig>;
  try { config = readConfig(); }
  catch (cause) { return <Frame header={<AppHeader />}><Title>A little setup first.</Title><Alert>{(cause as Error).message}</Alert></Frame>; }
  return <SessionGate config={config} />;
}

type ProfileState = { kind: 'loading' } | { kind: 'ready'; profile: Profile | null; owner: string } | { kind: 'error'; message: string };
function SessionGate({ config }: { config: ReturnType<typeof readConfig> }) {
  const { service: reminders } = useReminders();
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
  const [editingProfile, setEditingProfile] = useState(false);
  const [section, setSection] = useState<Section>('lab');
  /** A cold start with no session opens on the public page; signing out or expiring goes to the form. */
  const [visitor, setVisitor] = useState<'landing' | 'signIn' | 'signUp'>('landing');
  const [navigation, setNavigation] = useState(0);
  /** After a first setup: check the device, then show the guide once. */
  const [guide, setGuide] = useState<'no' | 'checking' | 'show'>('no');
  const pendingDraftRemoval = useRef<string | null>(null);
  const lastOwner = useRef<string | null>(null);

  const signOut = useCallback(async (reason: string | null = null) => {
    if (!reason && session) pendingDraftRemoval.current = session.user.id;
    setVisitor('signIn'); setSection('lab'); setEditingProfile(false); setGuide('no'); setSession(null); setProfile({ kind: 'loading' }); setMessage(reason); setAuthFailure(null);
    try {
      if (pendingDraftRemoval.current) { await clearDraft(pendingDraftRemoval.current); pendingDraftRemoval.current = null; }
      await reminders.signOut();
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch { setAuthFailure('signout'); }
  }, [client, reminders, session]);
  const expire = useCallback(() => { void signOut('Your session has expired. Sign in again.'); }, [signOut]);

  useEffect(() => {
    let cancelled = false;
    const { data } = client.auth.onAuthStateChange((_event, current) => {
      if (!cancelled) {
        if (lastOwner.current !== (current?.user.id ?? null)) { setProfile({ kind: 'loading' }); setEditingProfile(false); }
        lastOwner.current = current?.user.id ?? null; setSession(current); setReady(true);
      }
    });
    client.auth.getSession().then(({ data, error }) => {
      if (cancelled) return;
      if (error) setAuthFailure('restore'); else { lastOwner.current = data.session?.user.id ?? null; setSession(data.session); }
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

  const owner = session?.user.id ?? null;
  useEffect(() => { if (ready) void reminders.setOwner(owner); }, [owner, ready, reminders]);
  const token = session?.access_token;
  useEffect(() => {
    if (!token || offline) return;
    let cancelled = false;
    getProfile(token).then(value => {
      if (!cancelled) setProfile({ kind: 'ready', profile: value, owner: owner! });
    }).catch((cause: unknown) => {
      if (cancelled) return;
      if (cause instanceof ApiError && cause.status === 401) {
        void signOut('Your session has expired. Sign in again.');
      } else setProfile(current => current.kind === 'ready' && current.owner === owner && current.profile
        ? current // A background re-read after a token refresh must not unmount the open screen and its state.
        : { kind: 'error', message: cause instanceof Error ? cause.message : "Couldn't load your profile. Try again." });
    });
    return () => { cancelled = true; };
  }, [token, owner, offline, profileAttempt, signOut]);

  const retry = () => { setReady(false); setAuthFailure(null); setProfile({ kind: 'loading' }); setAuthAttempt(n => n + 1); };

  const hasProfile = profile.kind === 'ready' && profile.owner === owner && profile.profile !== null;
  const onLanding = ready && !session && !authFailure && visitor === 'landing';
  const goHome = () => {
    if (!session) { setVisitor('landing'); setMessage(null); return; }
    setEditingProfile(false); setSection('lab'); setNavigation(n => n + 1);
  };
  const choose = (next: Section) => { setEditingProfile(false); setSection(next); setNavigation(n => n + 1); };
  const header = <AppHeader signedIn={Boolean(session)} onHome={ready && !authFailure ? goHome : undefined} account={session && !hasProfile ? { email: session.user.email ?? 'your account', onSignOut: () => void signOut() } : undefined} />;
  const tabs = session && hasProfile && !editingProfile && !authFailure && guide === 'no' ? <TabBar section={section} onSection={choose} /> : undefined;
  return <NavProvider>
    <Frame header={onLanding ? undefined : header} tabs={tabs} bare={onLanding}>
      {authFailure ? <>
        <Alert>{authFailure === 'restore' ? "Couldn't restore your saved session." : "Couldn't remove your saved session."} Try again.</Alert>
        <Action label="Try again" onPress={authFailure === 'signout' ? () => void signOut(message) : retry} />
      </> : !ready ? <Loading message="Opening your rhythm…" /> : !session ? visitor === 'landing' ? <Landing onStart={() => setVisitor('signUp')} onSignIn={() => setVisitor('signIn')} /> : <AuthForm key={visitor}
        offline={offline} message={message} initialMode={visitor} onBack={message ? undefined : () => setVisitor('landing')}
        authenticate={async (mode, email, password) => {
          const { data, error } = mode === 'signIn'
            ? await client.auth.signInWithPassword({ email, password })
            : await client.auth.signUp({ email, password });
          if (error) throw error;
          if (!data.session) return false;
          setProfile({ kind: 'loading' }); setMessage(null); setSession(data.session);
          return true;
        }}
      /> : <>
        {profile.kind === 'ready' && profile.owner === owner && profile.profile !== null && editingProfile ? <Onboarding key={session.user.id} owner={session.user.id} token={session.access_token} offline={offline} initial={profile.profile}
            onSaved={value => { setProfile({ kind: 'ready', profile: value, owner: session.user.id }); setEditingProfile(false); }} onExpired={expire} onCancel={() => setEditingProfile(false)} />
          : profile.kind === 'ready' && profile.owner === owner && profile.profile !== null && guide === 'show' ? <FirstRunGuide onDone={() => setGuide('no')} />
          : profile.kind === 'ready' && profile.owner === owner && profile.profile !== null && guide === 'checking' ? <Loading message="Opening your rhythm…" />
          : profile.kind === 'ready' && profile.owner === owner && profile.profile !== null ? <Today key={session.user.id} token={session.access_token} offline={offline} profile={profile.profile} onExpired={expire} section={section} navigation={navigation} onSection={setSection} editProfile={() => setEditingProfile(true)} email={session.user.email ?? 'your account'} onSignOut={() => void signOut()} />
          : profile.kind === 'ready' && profile.owner === owner && profile.profile === null ? <Onboarding key={session.user.id} owner={session.user.id} token={session.access_token} offline={offline}
            onSaved={value => { setProfile({ kind: 'ready', profile: value, owner: session.user.id }); setGuide('checking'); void firstRunSeen().then(seen => setGuide(seen ? 'no' : 'show')); }} onExpired={expire} />
          : offline ? <><Title>No connection</Title><Copy>Your saved session is here. Reconnect to load your profile.</Copy></>
          : profile.kind === 'loading' || (profile.kind === 'ready' && profile.owner !== owner) ? <Loading message="Loading your profile…" />
          : profile.kind === 'error' ? <><Alert>{profile.message}</Alert><Action label="Try again" onPress={() => { setProfile({ kind: 'loading' }); setProfileAttempt(n => n + 1); }} /></>
          : null}
      </>}
      {ready && !session && <ReminderNotice feedbackOnly />}
    </Frame>
  </NavProvider>;
}
