// Draws the app icon and splash mark from brand tokens: npm run assets --workspace=@rhythm-health/mobile
// The ring is the day from onboarding: night sleep, moss waking hours, a sun marker. Needs macOS `sips`
// and the web workspace's Chromium (npx playwright install chromium).
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(root, '..', '..');
const { chromium } = createRequire(join(repo, 'frontend', 'package.json'))('@playwright/test');
const { colors } = JSON.parse(readFileSync(join(repo, 'packages', 'brand', 'src', 'tokens.json'), 'utf8'));

const SIZE = 1024;
const ring = (radius, width, background) => {
  const length = 2 * Math.PI * radius;
  const sleep = length / 3;
  // A third of the day asleep, centred on the bottom of the ring; the sun sits at the top.
  const sun = { x: SIZE / 2, y: SIZE / 2 - radius };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    ${background ? `<rect width="${SIZE}" height="${SIZE}" fill="${background}"/>` : ''}
    <circle cx="512" cy="512" r="${radius}" fill="none" stroke="${colors.moss}" stroke-width="${width}"/>
    <circle cx="512" cy="512" r="${radius}" fill="none" stroke="${colors.night}" stroke-width="${width}"
      stroke-dasharray="${sleep} ${length - sleep}" transform="rotate(30 512 512)"/>
    <circle cx="${sun.x}" cy="${sun.y}" r="${width * 0.72}" fill="${colors.sun}" stroke="${background ?? colors.oat}" stroke-width="${width * 0.24}"/>
  </svg>`;
};

const assets = join(root, 'assets');
mkdirSync(assets, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
const draw = async (svg, options) => {
  await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`);
  await page.screenshot(options);
};

// iOS rejects transparency in the icon: a JPEG has no alpha channel, so sips writes an RGB PNG.
const opaque = join(assets, 'icon.tmp.jpg');
await draw(ring(290, 104, colors.oat), { path: opaque, type: 'jpeg', quality: 100 });
execFileSync('sips', ['-s', 'format', 'png', opaque, '--out', join(assets, 'icon.png')], { stdio: 'ignore' });
rmSync(opaque);
// Android crops adaptive icons to the centre, so this mark stays inside the safe zone.
await draw(ring(220, 80), { path: join(assets, 'adaptive-icon.png'), omitBackground: true });
await draw(ring(290, 104), { path: join(assets, 'splash-icon.png'), omitBackground: true });
await browser.close();
