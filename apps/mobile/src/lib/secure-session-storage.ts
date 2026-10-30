import type * as SecureStore from 'expo-secure-store';
type Driver = Pick<typeof SecureStore, 'getItemAsync' | 'setItemAsync' | 'deleteItemAsync'>;
export function createSecureSessionStorage(_driver: Driver) {
  return {
    getItem: async (_key: string): Promise<string | null> => null,
    setItem: async (_key: string, _value: string): Promise<void> => {},
    removeItem: async (_key: string): Promise<void> => {},
  };
}
