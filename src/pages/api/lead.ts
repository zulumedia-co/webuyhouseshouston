import type { APIRoute } from 'astro';
import {
  parseAndValidate,
  isSpam,
  deliverLeadWithFallback,
  redactLead,
  redactErrorText,
  newLeadRef,
  escapeHtml,
} from '@/lib/leads';
import { CONTACT } from '@/config/site';

// The only non-static route on the site. Everything else is prerendered.
export const prerender = false;

/**
 * Validates the page a no-JS visitor should be offered a link back to.
 *
 * `pagePath` arrives in a hidden form field, so a visitor can set it to
 * anything. Only a same-site absolute path is accepted; everything else falls
 * back to the contact page.
 *
 * This matters even though the value is only used in a link, not a redirect:
 * putting unvalidated input into either would make this endpoint an open
 * redirect, letting an attacker use webuyhouseshouston.com as a trusted-looking
 * springboard to a scam site. That is a particularly bad failure for a business
 * whose customers are already on guard against fraud.
 */
function safeReturnPath(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  // A single leading slash, then only characters legal in a path. The set
  // excludes backslashes, quotes, whitespace and control characters.
  if (!/^\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/]*$/.test(value)) return '/contact-us/';
  // `//example.com` is protocol-relative — browsers read it as another origin.
  if (value.startsWith('//')) return '/contact-us/';
  return value;
}

/**
 * A self-contained error page for submissions made without JavaScript.
 *
 * A redirect back to the originating page would be pointless here: the error
 * banners on those pages are revealed by JavaScript, which by definition is not
 * running. This visitor would land on a page with no explanation at all. So we
 * return a real page that states the problem, shows the phone number, and
 * offers a link back to where they were.
 */
function errorPage(status: number, heading: string, detail: string, backTo: string): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(heading)}</title>
<style>
  body { margin:0; background:#0b1b33; color:#fff; font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  .wrap { max-width:34rem; margin:0 auto; padding:4rem 1.5rem; }
  h1 { font-size:1.75rem; line-height:1.2; margin:0 0 1rem; letter-spacing:-0.02em; }
  p { color:rgba(255,255,255,.7); }
  .tel { display:inline-block; margin:1.75rem 0 .5rem; font-size:2rem; font-weight:600; color:#fff; text-decoration:none; letter-spacing:-0.02em; }
  .tel:hover { color:#ddb84a; }
  .back { display:inline-block; margin-top:1.5rem; color:rgba(255,255,255,.7); }
  ul { color:rgba(255,255,255,.7); padding-left:1.1rem; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>${escapeHtml(heading)}</h1>
    <p>${detail}</p>
    <p>The quickest thing to do is call us — we will take your details over the phone.</p>
    <a class="tel" href="${CONTACT.phoneHref}">${escapeHtml(CONTACT.phone)}</a>
    <p><a class="back" href="${escapeHtml(backTo)}">&larr; Go back and try again</a></p>
  </div>
</body>
</html>`;

  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/**
 * Resolves the runtime environment, whichever host we are on.
 *
 * On Cloudflare, secrets set in the Pages dashboard are NOT exposed through
 * `import.meta.env` — that is baked at build time and would be empty. They
 * arrive per-request on `locals.runtime.env`. Reading that first means the CRM
 * credentials are actually found in production; the `import.meta.env` fallback
 * keeps `astro dev` and any other adapter working.
 *
 * Getting this wrong is silent: every adapter would throw "…is not set", the
 * visitor would be told to call, and no lead would ever reach the CRM.
 */
function resolveEnv(locals: App.Locals): Record<string, string | undefined> {
  const runtimeEnv = (locals as { runtime?: { env?: Record<string, unknown> } })?.runtime?.env;
  return {
    ...(import.meta.env as unknown as Record<string, string | undefined>),
    ...(runtimeEnv as Record<string, string | undefined> | undefined),
  };
}

export const POST: APIRoute = async ({ request, locals }) => {
  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');

  let form: FormData | null = null;
  try {
    form = await request.formData();
  } catch {
    if (wantsJson) {
      return new Response(JSON.stringify({ ok: false, error: 'Could not read submission.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return errorPage(
      400,
      "We couldn't read your submission",
      'Something went wrong sending your details to us.',
      '/contact-us/',
    );
  }

  const backTo = safeReturnPath(form.get('pagePath'));

  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  /** Success is a redirect for no-JS visitors, JSON for fetch() submissions. */
  const success = () =>
    wantsJson
      ? json(200, { ok: true })
      : new Response(null, { status: 303, headers: { Location: '/thank-you/' } });

  // Spam is accepted with a success response rather than rejected: telling a
  // bot it failed just invites a retry with the trap removed.
  const spam = isSpam(form);
  if (spam) {
    console.warn('[lead] discarded as spam:', spam);
    return success();
  }

  const { ok, errors, lead } = parseAndValidate(
    form,
    request.headers.get('user-agent') ?? '',
  );
  if (!ok || !lead) {
    if (wantsJson) return json(422, { ok: false, errors });
    const list = Object.values(errors).map((e) => `<li>${escapeHtml(e)}</li>`).join('');
    return errorPage(
      422,
      'We need a couple of details fixed',
      `Please check the following:</p><ul>${list}</ul><p>`,
      backTo,
    );
  }

  const ref = newLeadRef();
  const outcome = await deliverLeadWithFallback(lead, resolveEnv(locals));

  if (!outcome.delivered) {
    // Diagnostics carry no personal details — see redactLead. The reference is
    // shown to the visitor too, so a support call can be tied to these lines.
    console.error('[lead] DELIVERY FAILED', {
      ref,
      // Scrubbed as well as redacted: adapter errors are meant to carry only a
      // status, but this guarantees no provider message can smuggle contact
      // details into the log even if one changes.
      attempts: outcome.attempts.map((a) => ({
        adapter: a.adapter,
        error: redactErrorText(a.error),
      })),
      lead: redactLead(lead),
    });

    // No delivery path accepted the lead. Deliberately NOT logging the payload
    // here, even though it is the only remaining copy.
    //
    // An earlier version did, reasoning that losing a lead outright was worse
    // than a log entry. That reasoning does not survive contact with the
    // privacy policy this site publishes: it discloses the CRM, the email
    // provider and the host, and says nothing about writing contact details
    // into server logs. Recovering a lead from a log also only works if someone
    // is watching the logs, whereas the exposure lasts as long as retention
    // does. The visitor is told to call and given `ref` to quote, and the
    // redacted line above records that the enquiry happened.
    //
    // Configure the Resend fallback (RESEND_API_KEY + LEAD_EMAIL_TO) so this
    // branch stops being reachable at all — that is the real fix.
    if (outcome.allRoutesFailed) {
      console.error(
        `[lead] ${ref} ALERT: no delivery path succeeded — this enquiry reached nobody. ` +
          'Contact the visitor using the reference above if they call. ' +
          'Configure RESEND_API_KEY + LEAD_EMAIL_TO to prevent this.',
      );
    }

    if (wantsJson) {
      return json(502, {
        ok: false,
        ref,
        error: `We could not submit your request. Please call us at ${CONTACT.phone} and quote reference ${ref}.`,
      });
    }
    return errorPage(
      502,
      "We couldn't submit your request",
      `Your details reached us but we could not pass them on. Quote reference <strong>${escapeHtml(ref)}</strong> when you call and we will pick up where you left off.`,
      backTo,
    );
  }

  if (outcome.attempts.length > 0) {
    // Delivered, but not by the first route. Worth surfacing: the primary CRM
    // is failing even though visitors are seeing success.
    console.warn('[lead] delivered via fallback', {
      ref,
      via: outcome.via,
      failed: outcome.attempts.map((a) => ({
        adapter: a.adapter,
        error: redactErrorText(a.error),
      })),
    });
  }

  return success();
};

/** A GET here is almost always a misconfigured form or a crawler. */
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', Allow: 'POST' },
  });
