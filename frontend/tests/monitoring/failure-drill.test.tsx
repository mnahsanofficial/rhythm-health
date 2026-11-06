import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('@/lib/auth/supabase', () => ({ supabase: { auth: { getSession } } }));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('shows the friendly response and request ID without exposing credentials', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://127.0.0.1:8106');
  getSession.mockResolvedValue({ data: { session: { access_token: 'test-drill-token' } } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({detail:'Something went wrong. Please try again.'}),
    { status:500, headers:{'X-Request-ID':'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'} })));
  const { FailureDrill } = await import('../../app/dev/failure-drill/trigger');
  render(<FailureDrill />);
  fireEvent.click(screen.getByRole('button',{name:'Test backend crash'}));
  expect(await screen.findByText('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBeVisible();
  expect(screen.getByText('Something went wrong. Please try again.')).toBeVisible();
  expect(screen.queryByText('test-drill-token')).not.toBeInTheDocument();
});
