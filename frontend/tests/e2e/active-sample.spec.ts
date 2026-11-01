import { expect, test } from '@playwright/test';
import type { Checkin, Experiment } from '@rhythm-health/contract';
import { experiment } from '../support/fixtures';
import { timelineFixture } from '../support/timeline-fixture';
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from './helpers';

for (const width of [390, 1440]) {
  test(`active sample can be tried, checked in and removed at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const counts = await installApiMocks(page);
    await answerOnboardingWithMouse(page);
    await createAccountAndSaveProfile(page, counts);
    const sample: Experiment = { ...experiment, is_seeded: true, status: 'active', question: `Sample: ${experiment.question}`,
      progress: { ...experiment.progress, state: 'in_progress', day_number: 5, phase: 'intervention', phase_day: 2, phase_days: 7, days_remaining: 5 } };
    let present = false, startCalls = 0, removeCalls = 0, saved = false;
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const checkins = (): Checkin[] => [1, 2, 3, ...(saved ? [5] : [])].map(day => ({ id: `sample-${day}`, experiment_id: sample.id, day_number: day,
      phase: day <= 3 ? 'baseline' : 'intervention', intervention_completed: day > 3,
      metric_values: { morning_energy: 6, sleep_quality: 7 }, note: 'Sample check-in: invented answers.', created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-01T10:00:00Z' }));
    await page.route(`${API}/api/experiments?status=active`, route => route.fulfill({ json: present ? [sample] : [] }));
    await page.route(`${API}/api/demo/active`, async route => {
      expect(route.request().postDataJSON()).toEqual({}); startCalls++; present = true;
      await route.fulfill({ status: 201, json: sample });
    });
    await page.route(`${API}/api/demo/active/${sample.id}/remove`, async route => {
      expect(route.request().postDataJSON()).toEqual({ confirmed: true }); removeCalls++; present = false;
      await route.fulfill({ json: { removed: true } });
    });
    await page.route(`${API}/api/experiments/${sample.id}`, route => route.fulfill({ json: sample }));
    await page.route(`${API}/api/experiments/${sample.id}/progress`, route => route.fulfill({ json: timelineFixture(sample, { recorded: saved ? [1, 2, 3, 5] : [1, 2, 3], missed: [4], nextDayAt: '2026-11-02T10:00:00Z' }) }));
    await page.route(`${API}/api/experiments/${sample.id}/checkins`, async route => {
      if (route.request().method() === 'POST') { saved = true; await route.fulfill({ json: checkins().at(-1) }); }
      else await route.fulfill({ json: checkins() });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Try a sample experiment' }).click();
    await expect(page.getByText('Sample experiment', { exact: true })).toBeVisible();
    await expect(page.getByText('Day 5 of 10', { exact: true })).toBeVisible();
    await expect(page.getByText('Sample check-in: invented answers.')).toBeVisible();
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await page.screenshot({ path: `../docs/screenshots/active-sample/web-${width}-today.png`, fullPage: true });
    await page.getByRole('link', { name: 'Check in for day 5' }).click();
    await expect(page.getByText('Sample experiment · Sample check-in')).toBeVisible();
    // Reuse the same accessible scale controls as the real daily loop.
    await page.getByText('Yes', { exact: true }).click();
    await page.getByRole('group', { name: /Morning energy/ }).getByText('6', { exact: true }).click();
    await page.getByRole('group', { name: /Sleep quality/ }).getByText('7', { exact: true }).click();
    await page.getByRole('button', { name: /Save.*check-in/ }).click();
    await expect(page.getByRole('heading', { name: 'Day 5 recorded.' })).toBeVisible();
    await page.goto('/');
    await expect(page.getByText('Done for today', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Add day .*calendar/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Remove sample', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Remove this sample experiment?' })).toBeFocused();
    expect(removeCalls).toBe(0);
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await page.screenshot({ path: `../docs/screenshots/active-sample/web-${width}-remove.png`, fullPage: true });
    await page.getByRole('button', { name: 'Keep sample' }).click();
    expect(removeCalls).toBe(0);
    await page.getByRole('button', { name: 'Remove sample', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm remove sample' }).click();
    await expect(page.getByRole('button', { name: 'Try a sample experiment' })).toBeVisible();
    expect(startCalls).toBe(1); expect(removeCalls).toBe(1); expect(counts.proposals).toBe(0);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
