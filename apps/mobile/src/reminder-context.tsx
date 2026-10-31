import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Reminders } from './lib/reminders';
const Context = createContext<Reminders | null>(null);
export function ReminderProvider({ children }: { children: ReactNode }) {
  const [reminders] = useState(() => new Reminders());
  useEffect(() => reminders.start(), [reminders]);
  return <Context.Provider value={reminders}>{children}</Context.Provider>;
}
export function useReminders() {
  const service = useContext(Context);
  if (!service) throw new Error('ReminderProvider is required');
  const state = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  return { service, state };
}
