/**
 * Lead handling: validation, spam filtering, and CRM dispatch.
 *
 * The CRM is chosen at runtime via the LEAD_ADAPTER environment variable so
 * that swapping Guillermo's CRM never requires touching form or page code.
 * Adding a new CRM means adding one function to `ADAPTERS` below.
 */

export interface Lead {
  address: string;
  city: string;
  zip: string;
  name: string;
  phone: string;
  email: string;
  timeline: string;
  /** Free-text from the contact form's "How can we help?" box. */
  message: string;
  /**
   * Whether the visitor ticked the optional marketing-SMS opt-in.
   *
   * This is the TCPA / 10DLC audit trail. Only send recurring marketing texts
   * to numbers where this is true; replying about the specific property someone
   * asked about is transactional and covered by the submission itself.
   */
  smsConsent: boolean;
  /** Which version of the consent wording the visitor was shown. */
  consentVersion: string;
  source: string;
  pagePath: string;
  submittedAt: string;
  userAgent: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  lead?: Lead;
}

/**
 * A short reference for one submission, e.g. `K3X9F2`.
 *
 * Printed for the visitor when something goes wrong and attached to every log
 * line for that submission, so a support call can be tied to server logs
 * without those logs containing anything personal. The alphabet omits 0/O and
 * 1/I so it survives being read aloud over the phone.
 */
export function newLeadRef(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/**
 * A log-safe summary of a lead.
 *
 * Deliberately omits name, phone, email, street address and message. What
 * remains is enough to diagnose a problem and to match the record against the
 * CRM, without putting a distressed homeowner's contact details into a log
 * store that was never designed to hold them — and where the mere fact someone
 * contacted a cash buyer is itself sensitive.
 */
export function redactLead(lead: Lead): Record<string, unknown> {
  return {
    city: lead.city,
    zip: lead.zip,
    timeline: lead.timeline,
    source: lead.source,
    pagePath: lead.pagePath,
    submittedAt: lead.submittedAt,
    nameInitial: lead.name.trim().charAt(0).toUpperCase() || '?',
    phoneLast4: lead.phone.replace(/\D/g, '').slice(-4),
    hasEmail: Boolean(lead.email),
    messageLength: lead.message.length,
    smsConsent: lead.smsConsent,
    consentVersion: lead.consentVersion,
  };
}

/**
 * Strips anything that looks like contact information out of an error string.
 *
 * Second line of defence. Adapters are written not to embed response bodies in
 * their errors, but those errors get logged, and a future adapter — or a
 * provider SDK — could reintroduce customer data without anyone noticing. This
 * runs at the logging boundary so the guarantee does not depend on every
 * adapter author remembering.
 *
 * Digit runs of seven or more are masked; HTTP status codes and short numbers
 * survive so the message stays useful.
 */
export function redactErrorText(text: string): string {
  return text
    .replace(/[^\s@:"']+@[^\s@:"']+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/(\d[\d\-().\s]{5,}\d)/g, (match) =>
      match.replace(/\D/g, '').length >= 7 ? '[number]' : match,
    );
}

export interface DeliveryOutcome {
  delivered: boolean;
  /** The adapter that succeeded, if any. */
  via: string | null;
  attempts: Array<{ adapter: string; error: string }>;
  /**
   * True when no delivery path accepted the lead, so the server log is the
   * only place it can still be recovered from.
   */
  needsLogRecovery: boolean;
}

/**
 * Delivers a lead, falling back to email if the configured CRM fails.
 *
 * This exists so that failed deliveries do not have to be rescued out of log
 * files. A lead is worth a great deal to this business, so "drop it" was never
 * an acceptable answer to a CRM outage — but neither is writing a customer's
 * full contact details into logs on every failure. Giving the lead a second
 * route to a human removes the need to do either.
 *
 * The fallback only engages when the Resend credentials are configured and the
 * primary adapter is not already Resend.
 */
export async function deliverLeadWithFallback(lead: Lead, env: Env): Promise<DeliveryOutcome> {
  const primary = (env.LEAD_ADAPTER || 'console').toLowerCase();
  const attempts: DeliveryOutcome['attempts'] = [];

  try {
    await deliverLead(lead, env);
    return { delivered: true, via: primary, attempts, needsLogRecovery: false };
  } catch (err) {
    attempts.push({ adapter: primary, error: err instanceof Error ? err.message : String(err) });
  }

  const canEmail = Boolean(env.RESEND_API_KEY && env.LEAD_EMAIL_TO);
  if (canEmail && primary !== 'resend') {
    try {
      await resendAdapter(lead, env);
      return { delivered: true, via: 'resend (fallback)', attempts, needsLogRecovery: false };
    } catch (err) {
      attempts.push({ adapter: 'resend (fallback)', error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { delivered: false, via: null, attempts, needsLogRecovery: true };
}

const digits = (s: string) => s.replace(/\D/g, '');

export function parseAndValidate(form: FormData, userAgent = ''): ValidationResult {
  const get = (k: string) => String(form.get(k) ?? '').trim();
  const errors: Record<string, string> = {};

  const address = get('address');
  const city = get('city');
  const zip = get('zip');
  const name = get('name');
  const phone = get('phone');
  const email = get('email');

  if (!address) errors.address = 'Property address is required.';
  if (!city) errors.city = 'City is required.';
  if (!name) errors.name = 'Name is required.';

  if (!phone) {
    errors.phone = 'Phone number is required.';
  } else if (digits(phone).length < 10) {
    errors.phone = 'Please enter a valid phone number.';
  }

  // Email is optional, but if supplied it must be plausible.
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.email = 'Please enter a valid email address.';
  }
  if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) {
    errors.zip = 'Please enter a valid ZIP code.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    errors: {},
    lead: {
      address,
      city,
      zip,
      name,
      phone,
      email,
      timeline: get('timeline'),
      message: get('message'),
      smsConsent: get('smsConsent') === 'yes',
      consentVersion: get('consentVersion') || 'unversioned',
      source: get('source') || 'unknown',
      pagePath: get('pagePath') || '/',
      submittedAt: new Date().toISOString(),
      userAgent,
    },
  };
}

/**
 * Cheap, dependency-free spam filtering. Deliberately conservative — a false
 * positive here is a lost customer, so only unambiguous bot signals reject.
 */
export function isSpam(form: FormData): string | null {
  // Honeypot: a field hidden off-screen that only a bot would fill.
  if (String(form.get('company_website') ?? '').trim()) return 'honeypot';

  // Time trap: a human cannot read the page and complete two steps in under
  // three seconds. Missing/unparseable timestamps are allowed through, since
  // that just means JavaScript did not run.
  const rendered = Number(form.get('renderedAt'));
  if (Number.isFinite(rendered) && rendered > 0) {
    const elapsed = Date.now() - rendered;
    if (elapsed < 3000) return 'too-fast';
  }

  // Link-stuffed name fields are a classic spam signature.
  const name = String(form.get('name') ?? '');
  if (/https?:\/\/|\[url=|<a\s/i.test(name)) return 'links-in-name';

  return null;
}

// ---------------------------------------------------------------------------
// CRM adapters
// ---------------------------------------------------------------------------

type Env = Record<string, string | undefined>;
type Adapter = (lead: Lead, env: Env) => Promise<void>;

/**
 * How long to wait for a CRM before giving up.
 *
 * This runs on the visitor's request thread, so an unbounded wait leaves them
 * watching a "Sending…" spinner forever. 8s sits comfortably inside the
 * hosting platform's own function limit, so our timeout fires first and they
 * get the "please call us" message rather than a blank platform error.
 *
 * Defined once and used by every adapter — a per-adapter copy would drift.
 */
const CRM_TIMEOUT_MS = 8000;

/**
 * `fetch` with a bounded timeout and a readable error when it expires.
 * `label` names the destination so failures are identifiable in the logs.
 */
async function crmFetch(url: string, init: RequestInit, label: string): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(CRM_TIMEOUT_MS) });
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new Error(`${label} did not respond within ${CRM_TIMEOUT_MS}ms`);
    }
    throw err;
  }
}

/** Generic JSON webhook. Works with Zapier, Make, n8n, and most REI CRMs. */
const webhookAdapter: Adapter = async (lead, env) => {
  const url = env.LEAD_WEBHOOK_URL;
  if (!url) throw new Error('LEAD_WEBHOOK_URL is not set');

  const res = await crmFetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.LEAD_WEBHOOK_SECRET ? { Authorization: `Bearer ${env.LEAD_WEBHOOK_SECRET}` } : {}),
      },
      body: JSON.stringify(lead),
    },
    'Webhook',
  );
  if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
};

/** GoHighLevel — common in the REI space. Uses their inbound webhook format. */
const goHighLevelAdapter: Adapter = async (lead, env) => {
  const url = env.GHL_WEBHOOK_URL;
  if (!url) throw new Error('GHL_WEBHOOK_URL is not set');

  // Reuse splitName so every CRM derives first/last identically. A local
  // `split(' ')` here disagreed with it on names containing double spaces.
  const { first: firstName, last: lastName } = splitName(lead.name);
  const res = await crmFetch(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName,
        lastName,
        phone: lead.phone,
        email: lead.email || undefined,
        address1: lead.address,
        city: lead.city,
        postalCode: lead.zip,
        state: 'TX',
        source: lead.source,
        customField: {
          timeline: lead.timeline,
          message: lead.message,
          smsConsent: lead.smsConsent ? 'yes' : 'no',
          consentVersion: lead.consentVersion,
          pagePath: lead.pagePath,
        },
      }),
    },
    'GoHighLevel',
  );
  if (!res.ok) throw new Error(`GoHighLevel responded ${res.status}`);
};

/**
 * Splits a free-text name into first/last.
 *
 * Deliberately simple: first token is the first name, everything else is the
 * surname. This handles "Maria de la Cruz" and "Jan van Dijk" correctly, and
 * the failure mode for anything exotic is a slightly odd CRM record — never a
 * dropped lead.
 */
function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

/**
 * FlowTrack / CloseGPT — the engine behind app.zulumedia.co.
 *
 * Sends the flat, snake_case payload documented in `docs/crm-integration.md`.
 * The CRM form must be created with those exact field names.
 *
 * Auth is sent whichever way the platform expects: set FLOWTRACK_API_KEY for a
 * Bearer token, or leave it unset if the endpoint is an unauthenticated
 * inbound webhook (the usual case for a per-form webhook URL).
 */
const flowTrackAdapter: Adapter = async (lead, env) => {
  const url = env.FLOWTRACK_WEBHOOK_URL;
  if (!url) throw new Error('FLOWTRACK_WEBHOOK_URL is not set');

  const { first, last } = splitName(lead.name);

  const payload: Record<string, string> = {
    first_name: first,
    last_name: last,
    email: lead.email,
    phone: lead.phone,
    property_address: lead.address,
    property_city: lead.city,
    property_state: 'TX',
    property_zip: lead.zip,
    timeline: lead.timeline,
    message: lead.message,
    sms_consent: lead.smsConsent ? 'yes' : 'no',
    consent_version: lead.consentVersion,
    lead_source: lead.source,
    page_path: lead.pagePath,
    submitted_at: lead.submittedAt,
  };

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (env.FLOWTRACK_API_KEY) {
    headers.Authorization = `Bearer ${env.FLOWTRACK_API_KEY}`;
  }

  const res = await crmFetch(url, { method: 'POST', headers, body: JSON.stringify(payload) }, 'FlowTrack');

  if (!res.ok) {
    // The status alone, deliberately.
    //
    // This error message is captured into `attempts` and logged. A CRM
    // validation rejection routinely echoes the submitted value back — e.g.
    // `{"error":"Invalid phone","value":"(713) 555-8842"}` — so including the
    // response body here would put customer contact details straight back into
    // the logs that redactLead exists to keep them out of. It did, until this
    // was fixed; see the regression test in scripts/test-lead-logging.mjs.
    //
    // When a field-mapping problem genuinely needs the body, set
    // LEAD_DEBUG_CRM_ERRORS=true temporarily, then turn it back off.
    if (env.LEAD_DEBUG_CRM_ERRORS === 'true') {
      const body = await res.text().catch(() => '');
      throw new Error(
        `FlowTrack responded ${res.status}: ${body.slice(0, 300)} ` +
          '[LEAD_DEBUG_CRM_ERRORS is on — this may contain customer data]',
      );
    }
    throw new Error(`FlowTrack responded ${res.status}`);
  }
};

/** Email fallback via Resend, for when there is no CRM endpoint yet. */
const resendAdapter: Adapter = async (lead, env) => {
  const key = env.RESEND_API_KEY;
  const to = env.LEAD_EMAIL_TO;
  if (!key || !to) throw new Error('RESEND_API_KEY / LEAD_EMAIL_TO are not set');

  const rows = [
    ['Name', lead.name],
    ['Phone', lead.phone],
    ['Email', lead.email || '—'],
    ['Property', `${lead.address}, ${lead.city} ${lead.zip}`.trim()],
    ['Timeline', lead.timeline || '—'],
    ['Message', lead.message || '—'],
    ['Marketing SMS consent', lead.smsConsent ? `YES (${lead.consentVersion})` : 'No'],
    ['Source', `${lead.source} (${lead.pagePath})`],
    ['Submitted', lead.submittedAt],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 14px 6px 0;color:#6b7a91;font:600 13px system-ui">${k}</td>` +
        `<td style="padding:6px 0;color:#0b1b33;font:15px system-ui">${escapeHtml(v)}</td></tr>`,
    )
    .join('');

  const res = await crmFetch(
    'https://api.resend.com/emails',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.LEAD_EMAIL_FROM || 'leads@webuyhouseshouston.com',
        to: to.split(',').map((s) => s.trim()),
        reply_to: lead.email || undefined,
        subject: `New cash offer request — ${lead.address}, ${lead.city}`,
        html:
          `<h2 style="font:600 20px system-ui;color:#0b1b33">New Cash Offer Request</h2>` +
          `<table style="border-collapse:collapse">${rows}</table>`,
      }),
    },
    'Resend',
  );
  if (!res.ok) throw new Error(`Resend responded ${res.status}`);
};

/** Development default: log the lead so the form is testable with no config. */
const consoleAdapter: Adapter = async (lead) => {
  console.info('[lead] (console adapter — no CRM configured)', lead);
};

const ADAPTERS: Record<string, Adapter> = {
  flowtrack: flowTrackAdapter,
  webhook: webhookAdapter,
  gohighlevel: goHighLevelAdapter,
  resend: resendAdapter,
  console: consoleAdapter,
};

export async function deliverLead(lead: Lead, env: Env): Promise<void> {
  const name = (env.LEAD_ADAPTER || 'console').toLowerCase();
  const adapter = ADAPTERS[name];
  if (!adapter) {
    throw new Error(
      `Unknown LEAD_ADAPTER "${name}". Valid values: ${Object.keys(ADAPTERS).join(', ')}`,
    );
  }
  await adapter(lead, env);
}

/**
 * Escapes visitor-supplied text for safe inclusion in HTML.
 *
 * Covers both quote characters as well as the angle brackets and ampersand.
 * The current callers only place values in element text, where quotes are
 * harmless — but escaping them means the helper is also correct inside a
 * single- or double-quoted attribute, which is where the next caller is most
 * likely to put it. No dependency: this is a well-defined five-character
 * substitution, and adding a package to the project for it would be a worse
 * trade than owning six lines.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
