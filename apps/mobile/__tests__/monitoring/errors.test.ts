import { scrubEvent, startErrorReporting, drillEnabled } from '../../src/monitoring/errors';

test('no DSN does not load Sentry', () => {
  const load = jest.fn();
  expect(startErrorReporting('', load)).toBe(false);
  expect(load).not.toHaveBeenCalled();
});

test('Expo Go disables native capture and scrubs the entire event', () => {
  const init = jest.fn();
  expect(startErrorReporting('https://public@example.invalid/1', () => ({ init }), true)).toBe(true);
  const options = init.mock.calls[0][0];
  expect(options.enableNative).toBe(false);
  expect(options.sendDefaultPii).toBe(false);
  const secret = 'health-answer';
  expect(JSON.stringify(scrubEvent({ user: { id: secret }, extra: { note: secret }, message: secret,
    exception: { values: [{ type: 'Error', value: secret }] } }))).not.toContain(secret);
});

test('drill button requires both development and explicit opt in', () => {
  expect(drillEnabled(false, '1')).toBe(false);
  expect(drillEnabled(true, undefined)).toBe(false);
  expect(drillEnabled(true, '1')).toBe(true);
});
