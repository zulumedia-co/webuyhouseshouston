/**
 * End-to-end check of the lead form in a real browser.
 * The form is the business — this verifies the whole path, not just the API.
 */
import { chromium } from 'playwright';
import assert from 'node:assert';

const BASE = process.env.BASE || 'http://localhost:4322';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const fails = [];
const check = async (name, fn) => {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    fails.push(`${name}: ${e.message}`);
    console.log(`  FAIL  ${name} — ${e.message}`);
  }
};

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-offer-form] [data-next]', { state: 'visible' });

await check('step 1 visible, step 2 hidden on load', async () => {
  await page.waitForSelector('[data-offer-form]');
  assert.ok(await page.isVisible('[data-offer-form] [data-panel="1"]'));
  assert.ok(!(await page.isVisible('[data-offer-form] [data-panel="2"]')));
});

await check('empty step 1 blocks advance and shows an error', async () => {
  await page.click('[data-offer-form] [data-next]');
  await page.waitForTimeout(150);
  assert.ok(!(await page.isVisible('[data-offer-form] [data-panel="2"]')), 'advanced with empty fields');
  const err = await page.textContent('[data-offer-form] [data-error-for="address"]');
  assert.ok(err && err.trim().length, 'no error message shown');
});

await check('invalid ZIP is rejected', async () => {
  await page.fill('[data-offer-form] [name="address"]', '123 Main St');
  await page.fill('[data-offer-form] [name="city"]', 'Houston');
  await page.fill('[data-offer-form] [name="zip"]', 'abc');
  await page.click('[data-offer-form] [data-next]');
  await page.waitForTimeout(150);
  assert.ok(!(await page.isVisible('[data-offer-form] [data-panel="2"]')), 'advanced with a bad ZIP');
});

await check('valid step 1 advances to step 2', async () => {
  await page.fill('[data-offer-form] [name="zip"]', '77002');
  await page.click('[data-offer-form] [data-next]');
  await page.waitForTimeout(250);
  assert.ok(await page.isVisible('[data-offer-form] [data-panel="2"]'), 'did not advance');
});

await check('step indicator marks step 1 done', async () => {
  const state = await page.getAttribute('[data-step-dot="1"]', 'data-state');
  assert.equal(state, 'done', `expected done, got ${state}`);
});

await check('short phone number is rejected', async () => {
  await page.fill('[data-offer-form] [name="name"]', 'Jane Doe');
  await page.fill('[data-offer-form] [name="phone"]', '123');
  await page.click('[data-offer-form] [data-submit]');
  await page.waitForTimeout(250);
  assert.ok(page.url().endsWith('/'), 'submitted with an invalid phone');
});

await check('back button returns to step 1 with values kept', async () => {
  await page.click('[data-offer-form] [data-back]');
  await page.waitForTimeout(200);
  assert.ok(await page.isVisible('[data-offer-form] [data-panel="1"]'));
  assert.equal(await page.inputValue('[data-offer-form] [name="address"]'), '123 Main St');
  await page.click('[data-offer-form] [data-next]');
  await page.waitForTimeout(200);
});

await check('valid submission redirects to /thank-you/', async () => {
  await page.fill('[data-offer-form] [name="phone"]', '(713) 555-0123');
  await page.fill('[data-offer-form] [name="email"]', 'jane@example.com');
  await page.selectOption('[data-offer-form] [name="timeline"]', 'asap');
  await Promise.all([
    page.waitForURL('**/thank-you/', { timeout: 15000 }),
    page.click('[data-offer-form] [data-submit]'),
  ]);
  assert.ok(page.url().includes('/thank-you/'));
});

await check('thank-you page echoes the submitted address', async () => {
  await page.waitForTimeout(400);
  assert.ok(await page.isVisible('[data-submitted-address]'), 'address confirmation not shown');
  const t = await page.textContent('[data-address-value]');
  assert.equal(t?.trim(), '123 Main St');
});

await check('mobile menu opens and closes', async () => {
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await m.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await m.waitForSelector('[data-menu-toggle]', { state: 'visible' });
  await m.click('[data-menu-toggle]');
  await m.waitForTimeout(400);
  assert.ok(await m.isVisible('[data-menu-sheet]'), 'menu did not open');
  assert.equal(await m.getAttribute('[data-menu-toggle]', 'aria-expanded'), 'true');
  await m.keyboard.press('Escape');
  await m.waitForTimeout(500);
  assert.equal(await m.getAttribute('[data-menu-toggle]', 'aria-expanded'), 'false');
  await m.close();
});

await browser.close();

console.log(fails.length ? `\n${fails.length} FAILED` : '\nall form checks passed');
process.exit(fails.length ? 1 : 0);
