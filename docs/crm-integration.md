# CRM integration — app.zulumedia.co (FlowTrack / CloseGPT)

Everything needed to connect the site's lead forms to the CRM.

**Status:** adapter is written and ready (`LEAD_ADAPTER=flowtrack`). It needs
the form to exist in the CRM and one environment variable set. Until then the
site runs the `console` adapter, which logs leads and delivers nothing.

---

## 1. Create these fields on the CRM form

Use these **exact** field names. The site sends flat JSON with snake_case keys;
if a name differs, that value silently lands nowhere.

| Field name | Type | Required | Example | Notes |
|---|---|---|---|---|
| `first_name` | Text | Yes | `Maria` | First token of the name entered |
| `last_name` | Text | No | `de la Cruz` | Everything after the first token; empty if they gave one name |
| `phone` | Phone | Yes | `(713) 555-0123` | Sent exactly as typed, unformatted. **Always present** — this is the primary contact channel |
| `email` | Email | No | `maria@example.com` | Optional on the form; sent as `""` when not given |
| `property_address` | Text | Yes | `2110 Vinita St` | Street line only |
| `property_city` | Text | Yes | `Houston` | |
| `property_state` | Text | Yes | `TX` | Always `TX` |
| `property_zip` | Text | No | `77034` | Optional; sent as `""` when not given |
| `timeline` | Dropdown | No | `asap` | One of the four values below, or `""` |
| `message` | Long text | No | `My mother passed and…` | Only the contact form collects this; `""` from every offer form |
| `sms_consent` | Text | Yes | `yes` / `no` | **Compliance-critical.** Whether the marketing-SMS box was ticked — see below |
| `consent_version` | Text | Yes | `2026-07-v1` | Which wording they were shown, for the consent audit trail |
| `lead_source` | Text | Yes | `homepage-hero` | **Which page/placement produced the lead** — see below |
| `page_path` | Text | Yes | `/avoiding-foreclosure/` | URL the form was submitted from |
| `submitted_at` | Date/Text | Yes | `2026-07-28T04:12:33.918Z` | ISO 8601, UTC |

### `timeline` dropdown values

Store these raw values, not the labels:

| Value | Label shown to the visitor |
|---|---|
| `asap` | As soon as possible |
| `30-days` | Within 30 days |
| `60-90-days` | Within 60–90 days |
| `exploring` | Just exploring options |
| `""` | (not answered) |

### `lead_source` values

This is the field worth paying attention to — it tells you which pages actually
produce deals, so you know where to spend. Current values:

```
homepage-hero              get-a-cash-offer-today
sell-your-house            how-we-buy-houses
compare                    faq
our-company                avoiding-foreclosure
contact-us                 harris-county
harris                     property:vinita-3br
blog:<post-slug>           e.g. blog:how-to-sell-a-house-with-liens-in-houston
```

Blog leads carry the specific article slug, so you can see exactly which of the
335 posts convert. Treat this as a free-text field, not a fixed dropdown — new
pages will add new values.

---

## 1a. Text messaging — read before sending a single message

`sms_consent` is the field that keeps this business out of trouble. Two
different things are being tracked, and they are not interchangeable:

- **Transactional.** Someone submitted a form asking about their property, so
  replying by text about *that property* is expected and covered by the
  disclosure shown above the submit button. This applies to every lead.
- **Marketing** — recurring promotional messages, drip campaigns, "still
  thinking about selling?" follow-ups. This requires `sms_consent: yes`. Only
  ever send these to numbers where that field says yes.

Why it matters: TCPA statutory damages are **$500–$1,500 per message**, and
cash-buyer businesses are among the most frequently sued. A single drip campaign
sent to a few hundred non-consenting numbers is an existential number, not a
fine. `consent_version` records which wording the person actually saw, so
consent stays provable even after the copy is reworded.

**If you set up A2P 10DLC registration for the Zulu number**, the registration
will ask for the opt-in evidence. Point it at:

- Opt-in screenshot: the cash-offer form on any page, e.g. `/get-a-cash-offer-today/`
- Privacy policy URL: `https://webuyhouseshouston.com/privacy/`
- Terms / messaging disclosures URL: `https://webuyhouseshouston.com/terms/`

Both pages carry the mobile-data clause carriers look for, and the form shows the
opt-in language. Registrations are routinely rejected when any of those three is
missing — all three are now in place.

Whoever sends the messages must also honour **STOP** and **HELP** automatically.
FlowTrack/CloseGPT handles this for you, but confirm it is switched on: the site
promises both, so the promise has to be true.

---

## 2. Send me back one of these

**Preferred — an inbound webhook URL for that form:**

```
FLOWTRACK_WEBHOOK_URL=https://app.zulumedia.co/...
```

**Or, if it's a REST API with authentication:**

```
FLOWTRACK_WEBHOOK_URL=https://app.zulumedia.co/api/...
FLOWTRACK_API_KEY=...
```

If it's an API key, tell me how the platform expects it. The adapter currently
sends `Authorization: Bearer <key>`; if it wants `X-API-Key`, a query
parameter, or a form/campaign ID in the body, that's a two-line change — I just
need to know which.

---

## 3. Then set on the host

```
LEAD_ADAPTER=flowtrack
FLOWTRACK_WEBHOOK_URL=...
FLOWTRACK_API_KEY=...        # only if required
```

---

## 4. Exact payload the site sends

```http
POST <FLOWTRACK_WEBHOOK_URL>
Content-Type: application/json
Authorization: Bearer <FLOWTRACK_API_KEY>   # only when the key is set
```

```json
{
  "first_name": "Maria",
  "last_name": "de la Cruz",
  "email": "maria@example.com",
  "phone": "(713) 555-0123",
  "property_address": "2110 Vinita St",
  "property_city": "Houston",
  "property_state": "TX",
  "property_zip": "77034",
  "timeline": "asap",
  "message": "",
  "sms_consent": "yes",
  "consent_version": "2026-07-v1",
  "lead_source": "blog:how-to-sell-a-house-with-liens-in-houston",
  "page_path": "/blog/how-to-sell-a-house-with-liens-in-houston/",
  "submitted_at": "2026-07-28T04:12:33.918Z"
}
```

Every key is always present. Optional fields are sent as `""` rather than
omitted, so the CRM never receives a missing-key error.

Any 2xx response is treated as success. Anything else makes the site show the
visitor an error telling them to call 713-730-9000, quoting a short reference
code such as `K3X9F2`.

A CRM outage never looks like a successful submission. What happens on failure:

1. If the Resend fallback is configured, the lead is **emailed instead** and the
   visitor still sees success — the lead is not lost.
2. The failure is logged as `[lead] DELIVERY FAILED` with the reference code and
   non-identifying diagnostics. Customer contact details are **not** written to
   logs.
3. Only if *every* delivery route fails does the full record get logged, clearly
   marked, because at that point it is the sole surviving copy.

Configure `RESEND_API_KEY` and `LEAD_EMAIL_TO` and step 3 stops being reachable.
That is the recommended setup even with the CRM working.

---

## 5. Testing it

Once the variables are set, submit a real lead through the site and confirm it
lands. You can also hit the endpoint directly:

```bash
curl -X POST https://webuyhouseshouston.com/api/lead/ \
  -H "Accept: application/json" \
  -F "address=123 Test St" -F "city=Houston" -F "zip=77002" \
  -F "name=Test Lead" -F "phone=7135550123" \
  -F "email=test@example.com" -F "timeline=asap" \
  -F "source=manual-test" -F "renderedAt=$(( $(date +%s)000 - 10000 ))"
```

Expect `{"ok":true}` and a record in the CRM. **Note the trailing slash on
`/api/lead/`** — without it the request 404s.

Two behaviours that will look odd if you don't expect them:

- **Spam is accepted with a 200 and dropped.** Telling a bot it failed just
  invites a retry with the trap removed. If a test submission never arrives,
  check you waited more than 3 seconds between page load and submit — the
  sub-3-second timer treats it as a bot.
- **The contact form sends `property_address` as `General enquiry`** with the
  message in a `message` field, since that form has no property. If you want
  general enquiries kept separate, make a second CRM form and say so — I'll
  point the contact form at its own adapter target.
