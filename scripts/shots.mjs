import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { ROUTES } from './routes.mjs';

const BASE = process.env.BASE || 'http://localhost:4321';
const OUT = process.env.OUT || '/tmp/shots';
mkdirSync(OUT, { recursive: true });

const pages = ROUTES;

const browser = await chromium.launch();
const errors = [];

// try/finally so a navigation failure can never leak a Chromium process.
try {
for (const [viewport, size] of [
  ['desktop', { width: 1440, height: 1000 }],
  ['mobile', { width: 390, height: 844 }],
]) {
  const ctx = await browser.newContext({
    viewport: size,
    deviceScaleFactor: 2,
    isMobile: viewport === 'mobile',
  });
  const page = await ctx.newPage();

  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${viewport}] console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[${viewport}] pageerror: ${e.message}`));
  page.on('requestfailed', (r) => {
    // Ignore favicon/apple-touch noise that we deliberately do not ship.
    if (!/apple-touch-icon/.test(r.url())) {
      errors.push(`[${viewport}] failed: ${r.url()} (${r.failure()?.errorText})`);
    }
  });

  for (const [name, path] of pages) {
    const res = await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 });
    if (!res || res.status() >= 400) errors.push(`[${viewport}] ${path} -> ${res?.status()}`);
    // Let fonts settle so text is not captured mid-swap.
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    await page.screenshot({
      path: `${OUT}/${viewport}-${name}.png`,
      // Deliberately viewport-height, not full-page, on both: these shots are
      // for comparing what lands above the fold across desktop and mobile.
      fullPage: false,
    });
  }
  await ctx.close();
}
} finally {
  await browser.close();
}

if (errors.length) {
  console.log('ISSUES:');
  for (const e of [...new Set(errors)]) console.log(' -', e);
} else {
  console.log('no console errors, no failed requests, no bad status codes');
}
