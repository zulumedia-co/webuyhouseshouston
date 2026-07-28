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
  "lead_source": "blog:how-to-sell-a-house-with-liens-in-houston",
  "page_path": "/blog/how-to-sell-a-house-with-liens-in-houston/",
  "submitted_at": "2026-07-28T04:12:33.918Z"
}
```

Every key is always present. Optional fields are sent as `""` rather than
omitted, so the CRM never receives a missing-key error.

Any 2xx response is treated as success. Anything else makes the site show the
visitor an error telling them to call 713-730-9000 instead, and writes the full
lead to the server log prefixed `[lead] DELIVERY FAILED` so it can be recovered
by hand. A CRM outage will never look like a successful submission.

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
