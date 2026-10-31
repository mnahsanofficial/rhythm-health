import type * as SecureStore from 'expo-secure-store';
type Driver = Pick<typeof SecureStore, 'getItemAsync' | 'setItemAsync' | 'deleteItemAsync'>;
type Manifest = { slot: 'a' | 'b'; count: number; otherCount: number };

/** All payloads and metadata stay in encrypted native storage, below historical
 * iOS limits. Two slots retain the old session until every new chunk is written.
 * Pending chunk counts are recorded first, so interrupted writes can be removed.
 * Adapter operations serialize independently of SDK refresh coordination.
 * No token is logged or put in AsyncStorage.
 */
export function createSecureSessionStorage(driver: Driver) {
  async function manifest(key: string): Promise<Manifest | null> {
    const raw = await driver.getItemAsync(key);
    if (raw === null) return null;
    const value: Manifest = JSON.parse(raw);
    if (!['a', 'b'].includes(value.slot) || !Number.isInteger(value.count) || value.count < 0
      || !Number.isInteger(value.otherCount) || value.otherCount < 0) throw new Error("Couldn't read your saved session.");
    return value;
  }
  const other = (slot: 'a' | 'b') => slot === 'a' ? 'b' : 'a';
  async function removeChunks(key: string, slot: 'a' | 'b', count: number) {
    for (let i = 0; i < count; i++) await driver.deleteItemAsync(`${key}.${slot}.${i}`);
  }
  const store = {
    async getItem(key: string): Promise<string | null> {
      const meta = await manifest(key);
      if (!meta || meta.count === 0) return null;
      const chunks: string[] = [];
      for (let i = 0; i < meta.count; i++) {
        const chunk = await driver.getItemAsync(`${key}.${meta.slot}.${i}`);
        if (chunk === null) throw new Error("Couldn't read your saved session.");
        chunks.push(chunk);
      }
      return chunks.join('');
    },
    async setItem(key: string, value: string): Promise<void> {
      const old = await manifest(key) ?? { slot: 'a', count: 0, otherCount: 0 };
      const slot = other(old.slot);
      await removeChunks(key, slot, old.otherCount);
      const characters = Array.from(value); // Never split an emoji/surrogate pair.
      const chunks: string[] = [];
      const chunkCharacters = 420; // At most 1680 UTF-8 bytes per SecureStore value.
      for (let i = 0; i < characters.length; i += chunkCharacters) chunks.push(characters.slice(i, i + chunkCharacters).join(''));
      await driver.setItemAsync(key, JSON.stringify({ ...old, otherCount: chunks.length }));
      for (let i = 0; i < chunks.length; i++) await driver.setItemAsync(`${key}.${slot}.${i}`, chunks[i]);
      await driver.setItemAsync(key, JSON.stringify({ slot, count: chunks.length, otherCount: old.count }));
      await removeChunks(key, old.slot, old.count);
    },
    async removeItem(key: string): Promise<void> {
      const meta = await manifest(key);
      if (meta) {
        await removeChunks(key, meta.slot, meta.count);
        await removeChunks(key, other(meta.slot), meta.otherCount);
      }
      await driver.deleteItemAsync(key);
    },
  };
  let pending: Promise<void> = Promise.resolve();
  function ordered<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending.then(operation);
    // Reset the queue after either outcome; the original result/error goes to the caller.
    pending = result.then(() => undefined, () => undefined);
    return result;
  }
  return {
    getItem: (key: string) => ordered(() => store.getItem(key)),
    setItem: (key: string, value: string) => ordered(() => store.setItem(key, value)),
    removeItem: (key: string) => ordered(() => store.removeItem(key)),
  };
}
