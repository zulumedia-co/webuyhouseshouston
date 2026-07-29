import type { APIRoute } from 'astro';
import { parseAndValidate, isSpam, deliverLead, escapeHtml } from '@/lib/leads';
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

export const POST: APIRoute = async ({ request }) => {
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

  try {
    await deliverLead(lead, import.meta.env as unknown as Record<string, string | undefined>);
  } catch (err) {
    // A CRM outage must never look like a successful submission — the visitor
    // needs to know to call instead. The lead is logged so it is recoverable
    // from server logs even if delivery failed.
    console.error('[lead] DELIVERY FAILED — recover from this log:', JSON.stringify(lead), err);

    if (wantsJson) {
      return json(502, {
        ok: false,
        error: `We could not submit your request. Please call us at ${CONTACT.phone}.`,
      });
    }
    return errorPage(
      502,
      "We couldn't submit your request",
      'Your details reached us but we could not pass them on. Nothing is lost — but the fastest way to get your offer moving is to call.',
      backTo,
    );
  }

  return success();
};

/** A GET here is almost always a misconfigured form or a crawler. */
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', Allow: 'POST' },
  });
