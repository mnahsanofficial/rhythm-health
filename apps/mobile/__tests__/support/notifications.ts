import type { NotificationResponse, NotificationRequestInput } from 'expo-notifications';
export const responses = new Set<(response: NotificationResponse) => void>();
export const pending = new Map<string, NotificationRequestInput>();
const schedule = async (request: NotificationRequestInput) => { const id = request.identifier ?? 'rhythm.next-day'; pending.set(id, request); return id; };
const cancel = async (id: string) => { pending.delete(id); };
export const preferences = new Map<string, string>();
export const notificationState = { granted: false, denied: false, last: null as NotificationResponse | null };
export const notifications = {
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' }, AndroidImportance: { DEFAULT: 3 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  setNotificationHandler: jest.fn(), setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ granted: notificationState.granted, canAskAgain: !notificationState.denied })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: notificationState.granted, canAskAgain: !notificationState.denied })),
  scheduleNotificationAsync: jest.fn(schedule),
  getAllScheduledNotificationsAsync: jest.fn(async () => [...pending.values()]),
  cancelScheduledNotificationAsync: jest.fn(cancel),
  getLastNotificationResponse: jest.fn(() => notificationState.last), clearLastNotificationResponse: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn((listener: (response: NotificationResponse) => void) => { responses.add(listener); return { remove: () => responses.delete(listener) }; }),
};
export function resetNotifications() {
  pending.clear(); preferences.clear(); responses.clear(); notificationState.granted = false; notificationState.denied = false; notificationState.last = null;
  Object.values(notifications).forEach(value => { if (jest.isMockFunction(value)) value.mockClear(); });
  notifications.scheduleNotificationAsync.mockImplementation(schedule);
  notifications.cancelScheduledNotificationAsync.mockImplementation(cancel);
}
export function tapReminder(owner = 'fake-user', experiment = '22222222-2222-4222-8222-222222222222'): NotificationResponse {
  return { actionIdentifier: 'default', notification: { date: 1, request: { identifier: 'rhythm.next-day', trigger: null, content: { title: 'Day 5 of 10 is open', subtitle: null, categoryIdentifier: null, body: 'Your check-in takes about 30 seconds.', sound: null, badge: null, launchImageName: null, attachments: [], threadIdentifier: null, data: { kind: 'rhythm-checkin', owner, experiment } } } } } as NotificationResponse;
}
