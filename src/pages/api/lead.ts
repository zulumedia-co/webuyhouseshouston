import type { APIRoute } from 'astro';
import { parseAndValidate, isSpam, deliverLead } from '@/lib/leads';

// The only non-static route on the site. Everything else is prerendered.
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');

  const respond = (status: number, body: Record<string, unknown>) => {
    // Non-JS submissions get a redirect; fetch() submissions get JSON.
    if (!wantsJson) {
      const ok = status >= 200 && status < 300;
      return new Response(null, {
        status: 303,
        headers: { Location: ok ? '/thank-you/' : '/contact-us/?error=1' },
      });
    }
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return respond(400, { ok: false, error: 'Could not read submission.' });
  }

  // Spam is accepted with a 200 rather than rejected: telling a bot it failed
  // just invites a retry with the trap removed.
  const spam = isSpam(form);
  if (spam) {
    console.warn('[lead] discarded as spam:', spam);
    return respond(200, { ok: true });
  }

  const { ok, errors, lead } = parseAndValidate(
    form,
    request.headers.get('user-agent') ?? '',
  );
  if (!ok || !lead) {
    return respond(422, { ok: false, errors });
  }

  try {
    await deliverLead(lead, import.meta.env as unknown as Record<string, string | undefined>);
  } catch (err) {
    // A CRM outage must never look like a successful submission — the visitor
    // needs to know to call instead. The lead is logged so it is recoverable
    // from server logs even if delivery failed.
    console.error('[lead] DELIVERY FAILED — recover from this log:', JSON.stringify(lead), err);
    return respond(502, {
      ok: false,
      error: 'We could not submit your request. Please call us at 713-730-9000.',
    });
  }

  return respond(200, { ok: true });
};

/** A GET here is almost always a misconfigured form or a crawler. */
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', Allow: 'POST' },
  });
