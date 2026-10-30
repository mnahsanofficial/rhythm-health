import { getProfile } from '../src/lib/profile';
import { profile } from '../../../frontend/tests/support/fixtures';

beforeEach(() => { global.fetch = jest.fn(); });

test('loads the shared profile contract with bearer auth and no identity parameters', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: async () => profile });
  await expect(getProfile('fake-token')).resolves.toEqual(profile);
  expect(global.fetch).toHaveBeenCalledWith('http://api.test.invalid:8001/api/profile', {
    method: 'GET', headers: { Authorization: 'Bearer fake-token' },
  });
});

test('404 is an empty profile, not a fabricated profile', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });
  await expect(getProfile('fake-token')).resolves.toBeNull();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test.each([401, 422, 500, 503])('preserves status %i for the screen to handle', async status => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status });
  await expect(getProfile('fake-token')).rejects.toMatchObject({ status });
});

test('network failures are distinct from an expired session', async () => {
  (global.fetch as jest.Mock).mockRejectedValue(new TypeError('Fake offline'));
  await expect(getProfile('fake-token')).rejects.toMatchObject({ status: 0 });
});
