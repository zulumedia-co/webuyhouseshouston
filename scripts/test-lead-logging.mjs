/**
 * Verifies that a failed CRM delivery does not spill customer personal details
 * into the logs, and that a configured fallback rescues the lead.
 *
 * This is the regression guard for the PII-in-logs finding. It runs the real
 * lead pipeline in-process with stubbed network calls, so it needs no server.
 */
import assert from 'node:assert';

// leads.ts is plain TypeScript with no runtime imports, so Node's built-in
// type stripping can load it directly — see the `test:leads` npm script.
const { parseAndValidate, deliverLeadWithFallback, redactLead, newLeadRef } = await import(
  new URL('../src/lib/leads.ts', import.meta.url).href
);

const fails = [];
const check = (name, fn) => {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    fails.push(`${name}: ${e.message}`);
    console.log(`  FAIL  ${name} — ${e.message}`);
  }
};
const checkAsync = async (name, fn) => {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    fails.push(`${name}: ${e.message}`);
    console.log(`  FAIL  ${name} — ${e.message}`);
  }
};

// A lead containing every sensitive field, with distinctive values we can
// search the captured log output for.
const form = new FormData();
form.set('address', '4821 Sensitive Street');
form.set('city', 'Houston');
form.set('zip', '77034');
form.set('name', 'Aurelia Featherstonehaugh');
form.set('phone', '(713) 555-8842');
form.set('email', 'aurelia.private@example.com');
form.set('message', 'My mother passed and the house is in probate.');
form.set('source', 'test');
form.set('pagePath', '/avoiding-foreclosure/');

const { ok, lead } = parseAndValidate(form, 'test-agent');
assert.ok(ok && lead, 'fixture lead should validate');

const SECRETS = [
  '4821 Sensitive Street',
  'Aurelia',
  'Featherstonehaugh',
  '5558842',
  '(713) 555-8842',
  'aurelia.private@example.com',
  'My mother passed',
];

check('redactLead strips every personal field', () => {
  const dump = JSON.stringify(redactLead(lead));
  for (const secret of SECRETS) {
    assert.ok(!dump.includes(secret), `redacted summary still contains "${secret}"`);
  }
});

check('redactLead keeps enough to diagnose and correlate', () => {
  const r = redactLead(lead);
  assert.equal(r.city, 'Houston');
  assert.equal(r.phoneLast4, '8842', 'last 4 digits help match the CRM record');
  assert.equal(r.nameInitial, 'A');
  assert.equal(r.hasEmail, true);
  assert.equal(r.source, 'test');
});

check('marketing SMS consent is opt-in, never assumed', () => {
  // Absent checkbox must mean NO. A default of true here would be the single
  // most expensive bug on the site — TCPA damages run per message.
  const noBox = new FormData();
  for (const [k, v] of form.entries()) if (k !== 'smsConsent') noBox.set(k, v);
  const { lead: withoutBox } = parseAndValidate(noBox, 'test');
  assert.equal(withoutBox.smsConsent, false, 'consent defaulted to true with no checkbox');

  const ticked = new FormData();
  for (const [k, v] of form.entries()) ticked.set(k, v);
  ticked.set('smsConsent', 'yes');
  ticked.set('consentVersion', '2026-07-v1');
  const { lead: withBox } = parseAndValidate(ticked, 'test');
  assert.equal(withBox.smsConsent, true, 'ticked box did not register consent');
  assert.equal(withBox.consentVersion, '2026-07-v1', 'consent wording version not recorded');

  // Anything other than the exact opt-in value must not count as consent.
  for (const bogus of ['no', 'true', '1', 'on', '']) {
    const f = new FormData();
    for (const [k, v] of form.entries()) f.set(k, v);
    f.set('smsConsent', bogus);
    assert.equal(parseAndValidate(f, 't').lead.smsConsent, false, `"${bogus}" was treated as consent`);
  }
});

check('lead references are unique and phone-friendly', () => {
  const seen = new Set(Array.from({ length: 500 }, () => newLeadRef()));
  assert.equal(seen.size, 500, 'references collided');
  for (const ref of seen) {
    assert.match(ref, /^[2-9A-HJ-NP-Z]{6}$/, `"${ref}" contains ambiguous characters`);
  }
});

await checkAsync('a failing CRM with a working fallback delivers, and logs nothing sensitive', async () => {
  const originalFetch = globalThis.fetch;
  const logs = [];
  const realError = console.error;
  const realWarn = console.warn;
  console.error = (...a) => logs.push(a.map(String).join(' '));
  console.warn = (...a) => logs.push(a.map(String).join(' '));

  try {
    globalThis.fetch = async (url) => {
      // Primary CRM is down; the Resend fallback works.
      if (String(url).includes('resend.com')) return new Response('{}', { status: 200 });
      return new Response('gateway timeout', { status: 504 });
    };

    const outcome = await deliverLeadWithFallback(lead, {
      LEAD_ADAPTER: 'flowtrack',
      FLOWTRACK_WEBHOOK_URL: 'https://crm.example.com/hook',
      RESEND_API_KEY: 'test-key',
      LEAD_EMAIL_TO: 'guillermo@example.com',
    });

    assert.equal(outcome.delivered, true, 'fallback did not rescue the lead');
    assert.equal(outcome.needsLogRecovery, false, 'should not need log recovery when delivered');
    assert.ok(String(outcome.via).includes('resend'), 'wrong route reported');

    const all = logs.join('\n');
    for (const secret of SECRETS) {
      assert.ok(!all.includes(secret), `logs leaked "${secret}"`);
    }
  } finally {
    globalThis.fetch = originalFetch;
    console.error = realError;
    console.warn = realWarn;
  }
});

await checkAsync('with no fallback configured, the lead is reported unrecoverable', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('gateway timeout', { status: 504 });

    const outcome = await deliverLeadWithFallback(lead, {
      LEAD_ADAPTER: 'flowtrack',
      FLOWTRACK_WEBHOOK_URL: 'https://crm.example.com/hook',
      // No RESEND_API_KEY / LEAD_EMAIL_TO.
    });

    assert.equal(outcome.delivered, false);
    assert.equal(
      outcome.needsLogRecovery,
      true,
      'must flag that the log is the only surviving copy',
    );
    assert.equal(outcome.attempts.length, 1, 'should not have attempted an unconfigured fallback');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

console.log(fails.length ? `\n${fails.length} FAILED` : '\nall lead-logging checks passed');
process.exit(fails.length ? 1 : 0);
