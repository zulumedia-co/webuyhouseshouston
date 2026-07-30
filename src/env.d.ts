/// <reference types="astro/client" />

/**
 * Types the Cloudflare runtime onto `App.Locals`.
 *
 * On Cloudflare, per-request bindings and secrets arrive on
 * `locals.runtime.env` rather than through `import.meta.env` — see the note in
 * `astro.config.mjs` and `resolveEnv` in `pages/api/lead.ts`. Without this
 * declaration TypeScript does not know `locals.runtime` exists, which is why
 * that lookup previously needed an inline cast; a cast silences the compiler
 * but also means a typo in the path would go unnoticed.
 *
 * `Env` describes the variables the lead endpoint expects to find. They are all
 * optional because the site must build and run with none of them set — the
 * `console` adapter is the deliberate default, and every adapter reports its
 * own missing configuration at runtime rather than failing the build.
 */
interface Env {
  /** Which CRM adapter to use: flowtrack | webhook | gohighlevel | resend | console. */
  LEAD_ADAPTER?: string;

  FLOWTRACK_WEBHOOK_URL?: string;
  FLOWTRACK_API_KEY?: string;

  LEAD_WEBHOOK_URL?: string;
  LEAD_WEBHOOK_SECRET?: string;

  GHL_WEBHOOK_URL?: string;

  /** Also the automatic fallback when the primary CRM fails. */
  RESEND_API_KEY?: string;
  LEAD_EMAIL_TO?: string;
  LEAD_EMAIL_FROM?: string;
}

type CloudflareRuntime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends CloudflareRuntime {}
}
