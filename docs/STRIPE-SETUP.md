# Stripe setup — Phase 4

Steps that require your Stripe credentials. Run these yourself; none of them should be
handed to an agent, and no key in this file is ever committed.

---

## 0. Before anything else

Any key that has been pasted into a chat, an issue, or a shared document is compromised and
must be rolled — including test-mode keys, which still expose your test data and customer
records.

- **Dashboard password**: Stripe → Settings → Security → change password, enable 2FA.
- **API keys**: Stripe → Developers → API keys → *Roll key* on anything exposed.

---

## 1. Local test-mode run

The exit criteria for Phase 4 are "upgrade → downgrade → fail → recover, driven only by
webhooks". That needs **test-mode** keys (`sk_test_` / `pk_test_`). The application refuses
to start with a live key outside a production deployment — see `stripeConfigError()` in
`src/lib/billing/stripe-client.ts`.

### 1.1 Authenticate the CLI

```bash
stripe login
```

Prints a pairing code, opens a browser, and waits for you to approve it in your Stripe
dashboard. It cannot be completed non-interactively.

### 1.2 Create the products and prices

```bash
stripe products create --name "Pro" --description "Pro plan"
```

```bash
stripe prices create --product prod_XXX --unit-amount 2500 --currency usd --recurring.interval month
```

Repeat for Business (9900) and for yearly intervals. `free` and `enterprise` have no Stripe
price by design — one costs nothing, the other is negotiated.

### 1.3 Forward webhooks

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

This prints a `whsec_…` signing secret on startup. That value — **not** an API key — is what
`STRIPE_WEBHOOK_SECRET` expects. The CLI's secret is specific to the `listen` session and
differs from the one shown for a dashboard-registered endpoint.

### 1.4 Set the environment

Put these in `.env.local` (gitignored). Do not commit them.

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
CRON_SECRET=<any long random string>
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_BUSINESS_MONTHLY=price_...
STRIPE_PRICE_BUSINESS_YEARLY=price_...
```

Secret and publishable key must be in the **same mode**; the config guard rejects a mix,
because mismatched modes fail at payment confirmation with an opaque error long after the
point where it could be understood.

---

## 2. Exercising the exit criteria

With `stripe listen` running in one terminal and the app in another:

| Step | How | Expected |
|---|---|---|
| Subscribe | `POST /api/admin/organizations/<id>/checkout` `{planId:"pro",interval:"monthly"}` → open the returned URL, pay with `4242 4242 4242 4242` | `checkout.session.completed` + `customer.subscription.created` → org on Pro |
| Credits | automatic on `invoice.paid` | Pro's monthly allowance granted, `source='plan'` |
| Upgrade | same endpoint with `planId:"business"` | applied `immediate`, prorated charge, **anchor date unchanged** |
| Downgrade | same endpoint with `planId:"pro"` | applied `scheduled`, `pending_plan_id` set, plan unchanged until the boundary |
| Payment failure | `stripe trigger invoice.payment_failed` | status `past_due`, `grace_period_ends_at` set 7 days out, **plan retained** |
| Repeat failure | trigger again | grace period does **not** restart |
| Recovery | `stripe trigger invoice.paid` | back to `active`, grace cleared |
| Grace expiry | set `grace_period_ends_at` into the past, then `GET /api/cron/dunning` with `Authorization: Bearer $CRON_SECRET` | downgraded to Free, custom domains detached |
| Idempotency | `stripe events resend evt_...` | second delivery recorded as duplicate, no second credit grant |

Check `SELECT * FROM stripe_events` after each step — every delivery should appear exactly
once, and `status` should be `processed` or `ignored`, never `processing`.

---

## 3. Production

Set the same variables in the Vercel dashboard with **live** keys, register the webhook
endpoint at `https://<domain>/api/webhooks/stripe` in Stripe → Developers → Webhooks, and
subscribe it to:

```
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
payment_intent.succeeded
```

The dashboard endpoint has its own signing secret — different from the CLI's.

`CRON_SECRET` must be set in production or `/api/cron/dunning` refuses to run. It changes
customers' plans, so an unauthenticated caller being able to trigger it is worse than the
job not running.
