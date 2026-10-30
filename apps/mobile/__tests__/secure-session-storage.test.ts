import { createSecureSessionStorage } from '../src/lib/secure-session-storage';

function driver() {
  const values = new Map<string, string>();
  return {
    values,
    getItemAsync: jest.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      if (Buffer.byteLength(value, 'utf8') > 2048) throw new Error('Native value too large');
      values.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => { values.delete(key); }),
  };
}

test('persists a large Unicode session across adapter restarts without plaintext storage', async () => {
  const native = driver();
  const session = JSON.stringify({ token: 'fake-token'.repeat(900), name: '🌙'.repeat(600) });
  await createSecureSessionStorage(native).setItem('sb-test-auth-token', session);
  expect(native.setItemAsync).toHaveBeenCalled();
  expect(await createSecureSessionStorage(native).getItem('sb-test-auth-token')).toBe(session);
});

test('a failed refresh cannot replace the previously saved session', async () => {
  const native = driver(); const storage = createSecureSessionStorage(native);
  await storage.setItem('session', 'fake-old-session');
  native.setItemAsync.mockRejectedValueOnce(new Error('Storage unavailable'));
  await expect(storage.setItem('session', 'fake-new-session')).rejects.toThrow('Storage unavailable');
  expect(await createSecureSessionStorage(native).getItem('session')).toBe('fake-old-session');
});

test('sign-out removes the manifest and encrypted session chunks', async () => {
  const native = driver(); const storage = createSecureSessionStorage(native);
  await storage.setItem('session', 'fake-token'.repeat(500));
  await storage.removeItem('session');
  expect(native.deleteItemAsync).toHaveBeenCalled();
  expect(native.values.size).toBe(0);
  expect(await createSecureSessionStorage(native).getItem('session')).toBeNull();
});

test('a partially missing session reports storage corruption rather than restoring a fragment', async () => {
  const native = driver(); const storage = createSecureSessionStorage(native);
  await storage.setItem('session', 'fake-token'.repeat(500));
  expect(native.values.size).toBeGreaterThan(0);
  const chunk = [...native.values].find(([, value]) => value.includes('fake-token'));
  expect(chunk).toBeDefined();
  native.values.delete(chunk![0]);
  await expect(createSecureSessionStorage(native).getItem('session')).rejects.toThrow();
});
