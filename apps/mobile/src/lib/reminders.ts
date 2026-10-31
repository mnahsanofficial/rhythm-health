import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import type { DayData } from '../today';

const DAILY = 'rhythm.next-day', TEST = 'rhythm.test';
const preview = new Map<string, string>();
const read = (key: string) => Platform.OS === 'web' ? Promise.resolve(preview.get(key) ?? null) : SecureStore.getItemAsync(key);
const write = (key: string, value: string) => Platform.OS === 'web' ? Promise.resolve(preview.set(key, value)) : SecureStore.setItemAsync(key, value);
const key = (owner: string) => `rhythm.reminders.${owner}`;
type Intent = { owner: string; experiment: string };
type ReminderState = {
  owner: string | null; ready: boolean; choice: 'on' | 'off' | null; permission: boolean;
  busy: boolean; error: string | null; data: DayData | null; intent: Intent | null; notice: string | null;
};

/** One serialized native queue and fixed IDs: late reads cannot resurrect a signed-out
 * user's notification or stack duplicate reminders. No day/boundary math lives here. */
export class Reminders {
  private state: ReminderState = { owner: null, ready: false, choice: null, permission: false, busy: false, error: null, data: null, intent: null, notice: null };
  private listeners = new Set<() => void>();
  private queue = Promise.resolve();
  private revision = 0;
  private assigned = false;
  private handled = new Set<string>();
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private patch(value: Partial<ReminderState>) { this.state = { ...this.state, ...value }; this.listeners.forEach(listener => listener()); }
  private run(work: () => Promise<void>, clearError = true) {
    this.queue = this.queue.then(async () => {
      this.patch({ busy: true });
      try { await work(); if (clearError) this.patch({ error: null }); }
      catch { this.patch({ error: "Couldn't update your reminder. Try again; the app still works without reminders." }); }
      finally { this.patch({ busy: false }); }
    });
    return this.queue;
  }
  setOwner = (owner: string | null, force = false) => {
    if (this.assigned && owner === this.state.owner && !force) return;
    this.assigned = true;
    this.revision++;
    this.patch({ owner, ready: false, choice: null, permission: false, data: null });
    return this.run(async () => {
      if (Platform.OS !== 'web') { await Notifications.cancelScheduledNotificationAsync(DAILY); await Notifications.cancelScheduledNotificationAsync(TEST); }
      const choice = owner ? await read(key(owner)) : null;
      if (owner !== this.state.owner) return;
      this.patch({ choice: choice === 'on' || choice === 'off' ? choice : null, ready: true });
      await this.reconcile();
    });
  };
  refresh = (data: DayData | null) => {
    this.revision++; this.patch({ data });
    return this.run(() => this.reconcile(), false);
  };
  private async reconcile() {
    if (Platform.OS === 'web') return;
    const revision = this.revision, { owner, choice, data } = this.state;
    await Notifications.cancelScheduledNotificationAsync(DAILY);
    const next = data?.timeline.days.find(day => day.state === 'future' && data.timeline.progress.day_number !== null && day.day_number > data.timeline.progress.day_number);
    const at = data?.timeline.next_day_at;
    if (!owner || choice !== 'on') {
      await Notifications.cancelScheduledNotificationAsync(TEST); return;
    }
    const permission = await Notifications.getPermissionsAsync();
    if (revision !== this.revision) return;
    const allowed = permission.granted || permission.ios?.status === IosAuthorizationStatus.PROVISIONAL;
    this.patch({ permission: allowed });
    if (!allowed || data?.timeline.progress.state !== 'in_progress' || !next || !at) { await Notifications.cancelScheduledNotificationAsync(TEST); return; }
    const date = new Date(at);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) return;
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('rhythm', { name: 'Daily check-in', importance: AndroidImportance.DEFAULT });
    if (revision !== this.revision) return;
    await Notifications.scheduleNotificationAsync({ identifier: DAILY,
      content: { title: `Day ${next.day_number} of ${data.timeline.progress.total_days} is open`, body: 'Your check-in takes about 30 seconds.', data: { kind: 'rhythm-checkin', owner, experiment: data.experiment.id } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'rhythm' },
    });
    if (revision !== this.revision) await Notifications.cancelScheduledNotificationAsync(DAILY);
  }
  choose = (enabled: boolean) => {
    const owner = this.state.owner;
    if (!owner) return Promise.resolve();
    this.revision++;
    return this.run(async () => {
      let permission = false;
      if (enabled && Platform.OS !== 'web') {
        if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('rhythm', { name: 'Daily check-in', importance: AndroidImportance.DEFAULT });
        let status = await Notifications.getPermissionsAsync();
        if (!status.granted && status.canAskAgain) status = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
        permission = status.granted || status.ios?.status === IosAuthorizationStatus.PROVISIONAL;
      }
      if (owner !== this.state.owner) return;
      this.patch({ choice: enabled ? 'on' : 'off', permission });
      // Cancel an opt-out before touching storage: a write failure must fail closed.
      if (!enabled) await this.reconcile();
      await write(key(owner), enabled ? 'on' : 'off');
      if (enabled) await this.reconcile();
    });
  };
  retry = () => {
    if (!this.state.ready) return this.setOwner(this.state.owner, true);
    return this.run(async () => {
      const { owner, choice } = this.state;
      if (owner && choice) await write(key(owner), choice);
      await this.reconcile();
    });
  };
  signOut = () => { this.patch({ intent: null }); return this.setOwner(null); };
  consume = () => this.patch({ intent: null });
  receive = (response: Notifications.NotificationResponse | null) => {
    if (!response) return;
    const { request, date } = response.notification;
    const data = request.content.data;
    if (data?.kind !== 'rhythm-checkin' || typeof data.owner !== 'string' || typeof data.experiment !== 'string') return;
    const id = `${request.identifier}:${date}:${response.actionIdentifier}`;
    if (this.handled.has(id)) return;
    this.handled.add(id); this.patch({ intent: { owner: data.owner, experiment: data.experiment } });
    try { Notifications.clearLastNotificationResponse(); }
    catch { this.patch({ error: "Couldn't clear the reminder tap. Return to Today if it opens again." }); }
  };
  start = () => {
    if (Platform.OS === 'web') return () => {};
    Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
    const listener = Notifications.addNotificationResponseReceivedListener(this.receive);
    try { this.receive(Notifications.getLastNotificationResponse()); }
    catch { this.patch({ error: "Couldn't open the reminder. You can still check in from Today." }); }
    return () => listener.remove();
  };
  test = () => {
    if (!__DEV__ || Platform.OS === 'web') return Promise.resolve();
    return this.run(async () => {
      const { owner, choice, permission, data } = this.state;
      if (!owner || choice !== 'on' || !permission || data?.timeline.progress.state !== 'in_progress') return;
      await Notifications.cancelScheduledNotificationAsync(TEST);
      await Notifications.scheduleNotificationAsync({ identifier: TEST,
        content: { title: `Day ${data.timeline.progress.day_number} of ${data.timeline.progress.total_days} is open`, body: 'Your check-in takes about 30 seconds.', data: { kind: 'rhythm-checkin', owner, experiment: data.experiment.id } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 10, repeats: false, channelId: 'rhythm' },
      });
      if (owner !== this.state.owner || this.state.choice !== 'on') await Notifications.cancelScheduledNotificationAsync(TEST);
      else this.patch({ notice: 'Test reminder scheduled. Lock the phone, then tap the notification.' });
    });
  };
}
