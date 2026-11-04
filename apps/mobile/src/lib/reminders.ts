import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import type { DayData } from '../today';
import { devToolsOn } from './config';

const DAILY = 'rhythm.next-day', TEST = 'rhythm.test';
const dailyId = (experiment: string) => `${DAILY}.${experiment}`;
/** Includes the single fixed ID older versions of the app left scheduled. */
const isDaily = (id: string) => id === DAILY || id.startsWith(`${DAILY}.`);
/** Samples never get reminders, so the app only treats reminders as off when samples are all that's running. */
export const onlySamples = (data: DayData[] | null) => Boolean(data?.length) && data!.every(entry => entry.experiment.is_seeded);
const preview = new Map<string, string>();
const read = (key: string) => Platform.OS === 'web' ? Promise.resolve(preview.get(key) ?? null) : SecureStore.getItemAsync(key);
const write = (key: string, value: string) => Platform.OS === 'web' ? Promise.resolve(preview.set(key, value)) : SecureStore.setItemAsync(key, value);
const key = (owner: string) => `rhythm.reminders.${owner}`;
type Intent = { owner: string; experiment: string };
type ReminderState = {
  owner: string | null; ready: boolean; choice: 'on' | 'off' | null; permission: boolean;
  busy: boolean; error: string | null; data: DayData[] | null; intent: Intent | null; notice: string | null;
};

/** One serialized native queue and one stable ID per experiment: late reads cannot resurrect a signed-out
 * user's notification or stack duplicate reminders. No day/boundary math lives here. */
export class Reminders {
  private state: ReminderState = { owner: null, ready: false, choice: null, permission: false, busy: false, error: null, data: null, intent: null, notice: null };
  private listeners = new Set<() => void>();
  private queue = Promise.resolve();
  private revision = 0;
  private assigned = false;
  private observed = false;
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
    const changing = !this.assigned || owner !== this.state.owner;
    this.assigned = true;
    this.revision++;
    if (changing) this.observed = false;
    this.patch({ owner, ready: false, choice: null, permission: false, ...(changing ? { data: null } : {}) });
    return this.run(async () => {
      const choice = owner ? await read(key(owner)) : null;
      if (owner !== this.state.owner) return;
      this.patch({ choice: choice === 'on' || choice === 'off' ? choice : null, ready: true });
      if (Platform.OS !== 'web') {
        if (owner && choice === 'on') {
          // A restored offline session must not erase its own pending reminder.
          // Remove only our foreign-account IDs; fresh progress will reconcile ours.
          const pending = await Notifications.getAllScheduledNotificationsAsync();
          if (owner !== this.state.owner) return;
          for (const request of pending) if ((isDaily(request.identifier) || request.identifier === TEST) && request.content.data?.owner !== owner) await Notifications.cancelScheduledNotificationAsync(request.identifier);
          const status = await Notifications.getPermissionsAsync();
          if (owner !== this.state.owner) return;
          this.patch({ permission: status.granted || status.ios?.status === IosAuthorizationStatus.PROVISIONAL });
        } else {
          await this.cancelDaily();
          await Notifications.cancelScheduledNotificationAsync(TEST);
        }
      }
      if (this.observed) await this.reconcile();
    });
  };
  private async cancelDaily() {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    for (const request of pending) if (isDaily(request.identifier)) await Notifications.cancelScheduledNotificationAsync(request.identifier);
  }
  refresh = (data: DayData[] | null) => {
    this.observed = true;
    this.revision++; this.patch({ data });
    return this.run(() => this.reconcile(), false);
  };
  private async reconcile() {
    if (Platform.OS === 'web') return;
    const revision = this.revision, { owner, choice, data } = this.state;
    await this.cancelDaily();
    if (!owner || choice !== 'on' || onlySamples(data)) {
      await Notifications.cancelScheduledNotificationAsync(TEST); return;
    }
    const permission = await Notifications.getPermissionsAsync();
    if (revision !== this.revision) return;
    const allowed = permission.granted || permission.ios?.status === IosAuthorizationStatus.PROVISIONAL;
    this.patch({ permission: allowed });
    const planned = !allowed ? [] : (data ?? []).flatMap(entry => {
      const { experiment, timeline } = entry;
      const next = timeline.days.find(day => day.state === 'future' && timeline.progress.day_number !== null && day.day_number > timeline.progress.day_number);
      return !experiment.is_seeded && timeline.progress.state === 'in_progress' && next && timeline.next_day_at ? [{ entry, next, date: new Date(timeline.next_day_at) }] : [];
    });
    if (!planned.length) { await Notifications.cancelScheduledNotificationAsync(TEST); return; }
    const due = planned.filter(({ date }) => Number.isFinite(date.getTime()) && date.getTime() > Date.now());
    if (!due.length) return;
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('rhythm', { name: 'Daily check-in', importance: AndroidImportance.DEFAULT });
    for (const { entry: { experiment, timeline }, next, date } of due) {
      if (revision !== this.revision) return;
      const identifier = dailyId(experiment.id);
      await Notifications.scheduleNotificationAsync({ identifier,
        content: { title: `Day ${next.day_number} of ${timeline.progress.total_days} is open`, body: 'Your check-in takes about 30 seconds.', data: { kind: 'rhythm-checkin', owner, experiment: experiment.id } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'rhythm' },
      });
      if (revision !== this.revision) { await Notifications.cancelScheduledNotificationAsync(identifier); return; }
    }
  }
  choose = (enabled: boolean) => {
    const owner = this.state.owner;
    if (enabled && onlySamples(this.state.data)) return Promise.resolve();
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
    if (!devToolsOn() || Platform.OS === 'web') return Promise.resolve();
    return this.run(async () => {
      const { owner, choice, permission, data } = this.state;
      const entry = data?.find(item => !item.experiment.is_seeded && item.timeline.progress.state === 'in_progress');
      if (!owner || choice !== 'on' || !permission || !entry) return;
      await Notifications.cancelScheduledNotificationAsync(TEST);
      await Notifications.scheduleNotificationAsync({ identifier: TEST,
        content: { title: `Day ${entry.timeline.progress.day_number} of ${entry.timeline.progress.total_days} is open`, body: 'Your check-in takes about 30 seconds.', data: { kind: 'rhythm-checkin', owner, experiment: entry.experiment.id } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 10, repeats: false, channelId: 'rhythm' },
      });
      if (owner !== this.state.owner || this.state.choice !== 'on' || onlySamples(this.state.data)) await Notifications.cancelScheduledNotificationAsync(TEST);
      else this.patch({ notice: 'Test reminder scheduled. Lock the phone, then tap the notification.' });
    });
  };
}
