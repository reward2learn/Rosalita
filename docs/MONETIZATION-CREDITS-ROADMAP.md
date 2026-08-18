# Monetization & Credits Roadmap
### Adapting the Hercules.app two-currency model to the tokenizmyapp multi-tenant platform

**Status:** Proposal / not started
**Researched:** 2026-08-16 — live scrape of hercules.app (sitemap 177 URLs, docs `llms.txt` 89 pages, billing docs, plus authenticated billing screenshots)
**Target codebase:** `tokenizmyapp` (Next.js App Router + ZenStack/Prisma + Neon + Vercel)

---

## 0. Scope note — what we adapt vs. what we do not

**Adapt freely (business mechanics, not protected expression):**
- Two-currency credit architecture (build-time vs run-time)
- Plan tiering structure and proration/expiry lifecycle rules
- Per-resource metering with free allowance + overage
- Onboarding sequencing (prompt-first → refine → publish)
- Information architecture of the settings/billing surface

**Do NOT copy:**
- Marketing copy verbatim — write our own.
- The 15 `/customers/*` case studies and homepage testimonials. Those are **real named people and businesses endorsing a different product**. Reproducing them would be fabricating endorsements for our platform. Our social proof must come from our own customers.
- Visual trade dress (logo, exact layout, colour system).

Everything below concerns mechanics and architecture.

---

## 1. What Hercules actually does (extracted findings)

### 1.1 Site map shape (177 URLs)

| Section | Count | Purpose |
|---|---|---|
| `/changelog/*` | 122 | Ship-velocity signal + long-tail SEO. Dated, one page per feature. |
| `/docs/*` | 89 | Product surface. Exposes `llms.txt` machine index. |
| `/skills/*` | 15 | SEO landing pages (e.g. `seo-optimization`, `database-performance`) |
| `/customers/*` | 15 | Case studies |
| `/utilities/*` | 12 | Free dev tools (json-formatter, jwt-decoder, uuid-generator…) — pure top-of-funnel SEO |
| `/pricing`, `/blog`, `/careers`, `/legal/*`, `/abuse` | — | Standard |

**Two takeaways worth stealing:** (a) `changelog` as a 122-page SEO asset that doubles as trust-building; (b) `utilities` — free standalone tools that rank, requiring zero auth, funnelling to signup.

### 1.2 The core architectural idea: two separate currencies

This is the single most important finding. Hercules splits spend into two independent systems that **cannot cross-subsidise**:

| | **AI Credits** | **Cloud Credits** |
|---|---|---|
| Pays for | **Building** the app (agent inference) | **Running** the published app |
| Unit | Abstract "credits" | Real dollars (balance, e.g. `$0.02`) |
| Source | Monthly grant from plan | Pay-as-you-go balance |
| Expiry | **Grants expire 28–31 days** after issue | Balance does not expire |
| Top-up | Min $25; $25/$50/$100/custom | "Add balance", any amount |
| Auto-refill | Auto-reload *before hitting zero mid-build* | Auto top-up below threshold |
| Can go negative | No — build stops | **Yes** — balance can go negative |
| Volume deal | One-time credits, expire 12 months | Enterprise |

Docs quote: *"AI credits are included with your subscription and are used while building your app,"* whereas cloud credits apply once the app is operational.

### 1.3 Cloud metering table (verbatim rates, for calibration)

| Resource | Free/month | Overage |
|---|---|---|
| Function calls | 200k | $2.50 / million |
| File storage | 1 GB | $0.035 / GB-mo |
| Database storage | 500 MB | $0.27 / GB-mo |
| Database bandwidth | 1 GB | $0.27 / GB |
| Vector embedding storage | 100 MB | $0.70 / GB-mo |
| Vector embedding bandwidth | 500 MB | $0.14 / 1,000 query-GB |
| Data egress | 1 GB | $0.16 / GB |
| Node runtime compute | 2 GB-hr | $0.42 / GB-hr |
| V8 runtime compute | 2 GB-hr | $0.21 / GB-hr |
| AI Gateway | **none** | pay-as-you-go |

Usage alerts fire at **50% / 75% / 90% / 100%** of monthly allowance.

### 1.4 Plans

| | Free | Pro | Business | Enterprise |
|---|---|---|---|---|
| Price | $0 | **$25/mo** | **$199/mo** | Talk to sales |
| AI credits/mo | 15 | 50 | 50 | Volume discount |
| Key unlocks | Unlimited apps, subdomain publish, community support | Custom domains, remove badge, **buy top-ups**, **20× cloud usage**, email support | Teammates, private publishing, RBAC, daily backups, advanced privacy | SSO/SAML, dedicated support, custom integrations, onboarding, DPA, audit logs, SCIM |

Yearly billing saves **15%**.

Note the deliberate design: Pro and Business include the *same* 50 AI credits. Business is sold on **collaboration and governance**, not more AI. That decouples "how much can I build" from "how many people/how much control" — worth copying.

### 1.5 Billing lifecycle rules (the fiddly bits that matter)

- **Upgrade:** pay prorated difference; receive **prorated** credit difference immediately (not full amount); those credits expire **28 days** from grant; **billing cycle does not reset** — stays anchored to original signup date.
- **Downgrade:** takes effect at **start of next cycle**.
- Edge case they call out explicitly: *a higher tier that costs less is treated as a downgrade.*
- **Overdue:** 7-day grace → auto-downgrade to Free; **custom domains disconnected**, hosting limited, app may be shut off. Paying the overdue invoice restores plan and re-grants credits.
- **Payments:** cards only via Stripe (+ Apple/Google Pay, which are cards). Explicitly refused: ACH/SEPA/wire, PayPal, UPI, Pix, crypto, BNPL, POs/manual invoicing — all pushed to Enterprise.

### 1.6 Org model & settings IA

Organization is the billing entity (has name, slug, `org_01M0…` ID). Settings split:
- **Organization:** General, Billing, Teammates, SSO, Data residency, Commerce, Skills
- **Personal:** Profile, Security, Chat Integrations

Billing sub-tabs: **Plan | AI Credits | Cloud Credits | Invoices**. Usage history is filterable by **app**, **date range**, and **grouped by day**.

### 1.7 Onboarding

Prompt-first, no signup wall: homepage is a textarea (*"Build a scheduling app for my dental practice"*) → **Build it** → chat to refine → **Publish** → choose subdomain → live at `[app].onhercules.app`. Custom domain is a later, paid step. Auth is deferred until value is visible.

Homepage also offers **quick-start pills** — `CRM`, `ERP`, `HR portal` — that pre-fill the prompt. Cheap fix for blank-canvas paralysis.

### 1.8 The signup funnel — exact step sequence (observed)

A bottom-sheet modal over a blurred homepage. Six steps, `Back`/`Next` throughout:

| # | Screen | Content | Purpose |
|---|---|---|---|
| 1 | **Welcome** | "Build stunning `SaaS` `Internal Tools` `eCommerce` `Mobile` and more with AI" + hero art → `Get Started →` | Frame breadth of use cases |
| 2 | **Build powerful apps** | "Everything is built-in. No setup required." 4×3 grid of 12 tiles: AI, Backend, Database, Auth, Storage, Payments, Hosting, Security, Version Control, Analytics, Email, 1000+ APIs | Kill the "what else will I have to wire up?" objection |
| 3 | **Customize your branding** | OG-card preview mock (`acme.com` / "My Amazing Idea") + a simulated iMessage share | Make *shipping to the world* feel concrete |
| 4 | **Accept payments** | Push-notification mockups: "Lisa P. paid you $67.50", "$199.00", "$24.99" | Reframe cost as **revenue**, immediately before asking for the card |
| 5 | **How did you hear about us?** | Multi-select: YouTube, Friend, Google, X, Instagram, Colleague, LinkedIn, Reddit, Facebook, **ChatGPT**, TikTok, Other | **Attribution capture** — self-reported channel |
| 6 | **Unlock Hercules Pro** | Feature checklist + inline Stripe card form + country + `$25/month` w/ Monthly⇄Annual toggle + **`Skip for now`** vs `Start Subscription →` | The ask |

**Four things worth stealing outright:**

1. **The paywall sits *before* the user builds anything — but is skippable.** They bet that intent peaks right after signup, and take the card then. `Skip for now` means it costs them nothing when the bet fails. Not a hard gate.
2. **Screen 4 precedes screen 6 deliberately.** "Here's money arriving in your account" is the last thing you see before "here's $25/month." That ordering is the whole conversion argument.
3. **Attribution is captured in-funnel** (step 5), not inferred from UTMs. Near-zero build cost, and it's the only way to attribute word-of-mouth and *ChatGPT* — both invisible to analytics. Note they list ChatGPT as a channel at all.
4. The Pro pitch on screen 6 leads with **"5× AI credits"** as a headline benefit — credits are positioned as *the* upgrade driver, ahead of custom domains.

### 1.9 Credit top-up mechanics (the pricing detail that matters most)

The "Get more AI Credits" sheet offers `$25 / $50 / $100 / Custom`, each with a **bonus**:

| Pay | Base credits | Bonus | Total | Base/$ | **Total/$** |
|---:|---:|---:|---:|---:|---:|
| $25 | 50 | +100 | 150 | 2.00 | **6.00** |
| $50 | 100 | +175 | 275 | 2.00 | **5.50** |
| $100 | 212 | +312 | 524 | 2.12 | **5.24** |

**This is not a volume discount — it runs backwards.** Base rate is flat (~2 credits/$), but the bonus *shrinks* as a multiple of base (2.0× → 1.75× → 1.47×), so total value per dollar **decreases** with basket size: $6.00 → $5.50 → $5.24 of credit per dollar.

That is almost certainly a **first-purchase acquisition lever**, not a pricing ladder — front-loaded to convert the smallest, most hesitant buyer, with the bonus tapering so it doesn't bleed margin on whales. (Their *actual* volume discount is separate: one-time credits negotiated via sales, expiring in 12 months.) Treat these numbers as a promo snapshot, not a stable rate card.

Custom amounts are validated against a floor: entering `$10` returns *"The minimum is $25/mo — the Pro plan."* — i.e. **the top-up minimum is deliberately pinned to the Pro price**, so buying credits at all implies Pro.

### 1.10 Auth & error handling

Google OAuth (standard consent screen). Sign-in failure gets a dedicated branded page — *"Your sign-in session could not be verified"* + `Return to Home` + a contact-support link — rather than a raw error. Small detail, but it's the failure mode most likely to lose a signup.

### 1.11 Social proof format

Homepage carousel: *"Trusted by 100k+ businesses"*, one card per customer, each tagged with an **industry pill** (Home Services, Food & Beverage, Law firm, Logistics…) and leading with exactly **two hard metrics**:

> €250k saved on software / 46 apps built · 3 days to relaunch / $10k+ saved · 30× website traffic / $50k saved · +$200k added revenue / 49% higher store sales

The *format* — industry pill + two quantified outcomes — is the reusable part. The named businesses and their numbers are theirs; ours must be our own (see §0).

A second proof block follows it — *"Never coded before? Neither have our customers"* — with star-rated quote cards (photo, name, "Founder, {company}"). Same rule: format reusable, content is not.

### 1.12 Homepage narrative arc

Section order is an argument, not a layout. Observed sequence:

1. **Hero** — prompt box (`What can Hercules build for you?`) + quick-start pills
2. **Build by chatting** — chat mock showing a CRM being built, with green ticks (*Created contacts and accounts → Built opportunities section → Added RBAC → Published → Your CRM is ready*)
3. **Everything you need is built-in** — scrolling capability marquee
4. **Publish in a click** — "Published!" card w/ live URL, Web⇄Mobile toggle
5. **Scale to millions** — serverless framing + an "Active users 2,847,193" chart
6. **Govern with confidence** — *"secure and private, best-in-class uptime and permission management"* + a Users & Roles mock (`Admin` / `Editor` / `Viewer`)
7. **Social proof** — case-study carousel, then star-rated testimonials
8. **FAQ** — 7 accordions: *What is it? · How does it work? · What can I build? · What features are built in? · Do I need coding experience? · Can I publish to my own domain? · Can I build mobile apps?*
9. **Closing CTA** — *"Start building for free / No credit card required"* + the prompt box again

Two details worth noting: the arc runs **capability → proof → objection-handling → CTA**, and objections 5–6 (*"will it scale?"*, *"is it secure?"*) are exactly the ones an SMB buyer raises about an AI-built app. Also, the hero prompt box accepts **image upload** — multimodal input from the first interaction.

**Tension worth resolving deliberately:** the public CTA promises *"No credit card required"* while the signup funnel asks for a card at step 6. It works only because that step has `Skip for now`. If we copy the paywall placement without the skip, we break the landing-page promise.

### 1.13 Growth & trust surfaces the sitemap does not list

The footer exposes four routes that appear in **no `sitemap.xml` entry** — a sitemap-only scrape misses them entirely:

| Surface | What it is | Why it matters to us |
|---|---|---|
| **`/mcp`** | An MCP server letting **ChatGPT, Claude, Cursor** create/build/manage apps; listed in the **ChatGPT Apps directory** | Distribution *inside* other AI assistants — and it explains why `ChatGPT` is an option in the attribution question (§1.8 step 5). They are acquiring users where those users already are. |
| **`/affiliates`** | Referral/affiliate programme | A monetisation-adjacent growth channel absent from my Phase 7 |
| **`/forum`** | Community | Deflects support load; the Free tier's stated support channel is "community" |
| **`/status`** | Uptime/status page | Directly backs the "best-in-class uptime" claim in homepage section 6 |

Also worth flagging: **Chat Connectors** — 30+ MCP integrations (Hubspot, Slack, Salesforce, Zendesk) usable *while building*. Distinct from `/mcp`, which is the reverse direction (external assistants driving Hercules).

---

## 2. Where tokenizmyapp stands today (gap analysis)

Verified against the codebase:

| Capability | Status |
|---|---|
| Multi-tenant provisioning (Vercel project + Neon DB per tenant) | ✅ Built |
| Suite mode — many apps per tenant, sharing one DB | ✅ Built |
| AI provider abstraction (OpenAI / Vercel AI Gateway / OpenCode Zen) | ✅ Built (this session) |
| Per-tenant/app AI provider + key + model | ✅ Built (this session) |
| AI content generation pipeline | ✅ Built |
| **Organization / billing-owner entity** | ❌ **Missing** — `user_accounts` are per-tenant; nothing sits *above* tenants |
| **Any billing model** (plan, subscription, credit, grant, ledger, invoice) | ❌ **Missing** — zero billing models in `schema.zmodel` |
| **Stripe (or any PSP)** | ❌ **Missing** — no dependency |
| **Usage metering / token accounting** | ❌ **Missing** — AI calls are unmetered |
| **Quota enforcement** | ❌ **Missing** — generation is ungated |
| License tier concept | ⚠️ Vestigial only — `metadata.config.license.{key,tier}` is stored but **not enforced anywhere** |

**The critical structural gap:** billing needs an entity *above* tenant. Today the hierarchy is `Tenant → Apps`. It must become `Organization → Tenant → Apps`, with the Organization owning the subscription, credit balances, and payment method.

**The natural currency mapping** (this is why the Hercules model fits us so well):

```
Hercules AI credits  →  our AI generation (app-pack generation, content generation,
                        chat assistant) — already routed through resolveActiveAiConfig()
Hercules cloud creds →  our per-tenant Vercel deployment + Neon database
                        (already provisioned per tenant — meterable)
```

---

## 3. Implementation roadmap

Ordered so each phase is independently shippable and de-risks the next. **Phases 1–3 are the true foundation** — do not reorder them.

---

### Phase 1 — Organization layer (foundation, blocks everything else)

**Goal:** introduce the billing-owner entity. No billing logic yet.

1. **New models** in `zenstack/schema.zmodel`:
   ```
   Organization  id, slug, displayName, logoUrl, ownerUserId, createdAt,
                 referredBy?          // affiliate attribution — cheap now,
                                      // impossible to backfill later (Phase 7.10)
                 @@map("organizations")
   OrgMember     orgId, userId, role(owner|admin|member|billing), createdAt
                 @@unique([orgId, userId])
   ```
   Their org surface is exactly: logo upload, display name, editable slug, and a
   copyable immutable ID (`org_01M0…`). Worth matching — the copyable ID is what
   support asks for.
2. **Add `organization_id` to the root `tenants` registry table** — extend the idempotent
   `ensureTenantsTable()` migration list in `src/domain/tenant/tenant-service.ts`
   (`ADD COLUMN IF NOT EXISTS organization_id TEXT`). Follows the established
   no-migration-files pattern used throughout this codebase.
3. **Backfill:** create one "default" Organization, assign every existing tenant to it.
   Idempotent, run from the existing migrate route.
4. **Resolution helper** `resolveOrgForTenant(slug)` — mirrors the existing
   `resolveTenantDbUrl()` pattern. All billing reads/writes go through it.
5. **Admin UI:** Organization selector above the existing tenant selector in
   `tenant-admin-panel.tsx`.

> ⚠️ **Placement decision:** billing tables live in the **platform root DB**, never in a
> tenant's dedicated DB. A tenant DB is a customer-controlled data plane; billing state
> must be in the control plane. This is the opposite of the routing rule used for
> `admin/users` and `admin/groups` — deliberately so.

**Exit criteria:** every tenant resolves to exactly one org; admin can switch org context.

---

### Phase 2 — Plan catalog + entitlements (no payment yet)

**Goal:** define plans and *enforce* them, before charging anyone.

1. **Static plan catalog** at `src/lib/billing/plans.ts` — modelled on the existing
   `AI_PROVIDERS` catalog in `ai-providers-catalog.ts` (client-safe, no DB import):
   ```ts
   { id:'free'|'pro'|'business'|'enterprise',
     label, priceMonthly, priceYearly,        // yearly = monthly * 12 * 0.85
     aiCreditsPerMonth,                        // 15 / 50 / 50 / custom
     cloudMultiplier,                          // 1× / 20× / 20× / custom
     features: Feature[] }
   ```
2. **`Subscription` model:** `orgId, planId, status, interval, currentPeriodStart/End,
   cancelAtPeriodEnd, anchorDate`. Note `anchorDate` — required for the
   "billing cycle does not reset on upgrade" rule.
3. **Entitlement helper** `hasFeature(orgId, 'custom-domains')` — single chokepoint.
4. **Wire the first real gates** (these already exist as functionality and are the
   natural paywall boundaries):
   - `custom-domains` → the existing set-domain routes (`apps/[appId]/domains`)
   - `teammates` → `admin/tenants/[slug]/users`
   - `rbac` → the security-groups surface
   - `remove-badge` → deployed app footer
5. Free plan is the default for every existing org — **nothing breaks on rollout.**

**Exit criteria:** a Free org is genuinely blocked from custom domains; a Pro org is not.

---

### Phase 3 — AI credits (build-time currency)

**Goal:** meter and gate our own AI generation. **This is the highest-value phase** —
it directly caps the cost that is currently unbounded.

1. **Models:**
   ```
   CreditGrant   orgId, source(plan|addon|onetime|promo), amount, remaining,
                 grantedAt, expiresAt, planId
   CreditLedger  orgId, grantId, delta, reason, refType, refId, createdAt, metadata
   ```
   Ledger is **append-only**; balance = `SUM(remaining)` over unexpired grants.
   Never mutate a balance column directly — auditability is the whole point.
2. **Expiry:** grants expire **28–31 days** after issue (Hercules' rule; we should pick
   exactly 30 and document it). Consume **oldest-expiring-first**.
3. **Metering — the integration point already exists.** Every AI call now funnels through
   `resolveActiveAiConfig()` (`src/lib/ai-providers.ts`), and all three providers return
   OpenAI-shaped responses with a `usage` object. Capture `usage.prompt_tokens` /
   `usage.completion_tokens` at these call sites:
   - `content-generator.ts` — `callAiProviderForDocument()` ×2 + `generateDashboardData()`
   - `chat-with-session-tools.ts` — streaming + non-streaming
   - `app-pack-generator.ts`, `schema-generator.ts` (AI SDK `generateObject`)
4. **Credit conversion:** define `credits = f(model, tokens)`. Because BYO-provider is
   supported, the honest model is:
   - **Platform-key usage** → bill credits at our rate card.
   - **Tenant's own key (BYOK)** → **do not** charge AI credits; they already pay the
     provider directly. Charge a flat platform fee instead, or nothing.
   This distinction does not exist at Hercules (single provider) and is a genuine
   product advantage of our multi-provider design — do not paper over it.
5. **Pre-flight gate:** check balance before generation; on empty → `402` with the
   existing `ai_provider_no_credits` code path (already implemented) and an upsell.
6. **Auto-reload:** top up *before* a running generation hits zero — mid-run failure is
   the worst possible UX and is precisely why Hercules built this.
7. **Top-up packs + bonus:** model as `{ priceCents, baseCredits, bonusCredits }` rows in
   the plan catalog, **not** a computed rate — the observed pricing (§1.9) is deliberately
   non-linear and promotional, so it must be editable data, not a formula. Enforce a
   minimum tied to the paid plan price (their $25 floor = the Pro price).
   Keep `bonusCredits` on the `CreditGrant` as a separate `source='promo'` grant so
   promo generosity is measurable and can be withdrawn without touching purchased credits.

**Exit criteria:** generation decrements a balance; hitting zero blocks cleanly with an
actionable message; ledger reconciles to the balance.

#### Status — implemented

All seven items are built except the **charging half of auto-reload (item 6)**, which cannot
be completed before Phase 4: topping up mid-run requires a payment method, and none exists
until Stripe.

**Item 6's actual goal — never fail mid-run — is met without payment, via debt.** A
generation that outruns its balance completes and records the overage as debt; the *next*
generation is blocked until it is settled, and any new grant settles it automatically. So
work in progress is never interrupted and nothing is given away. Auto-reload, once Stripe
lands, becomes an optimisation on top: settle the debt without the customer being blocked
first.

Debt is represented as ledger entries with `grant_id IS NULL` (the schema already reserves
that for balance-level entries) rather than as negative grants, which would corrupt both
the balance sum and expiry handling. Incurring writes a negative marker; settling writes an
offsetting positive one, so the markers net to zero and outstanding debt stays derivable
from the ledger alone with no extra table.

This closed a live revenue leak: the gate required a balance of 1, a real generation costs
many, and `meterAiUsage` was reading past `consumed` — collecting 1 credit for a 400-credit
job and reporting that it had charged 400.

The reconciliation invariant is correspondingly:

    SUM(ledger.delta) === SUM(grants.remaining) − outstandingDebt

Debt is the only credit movement with no matching grant change, so it is exactly the gap
between the two sums. With nothing owed this reduces to the simple `ledger === grants` form.

Metering is wired at every platform-key AI call site: `content-generator.ts`,
`chat-with-session-tools.ts`, `app-pack-generator.ts`, `schema-generator.ts` and
`custom-template-generator.ts`. Pre-flight gates guard tenant creation, schema generation,
chat, app-pack materialization and custom-template builds.

`reconcileCredits()` implements the ledger invariant named in the exit criteria:
`SUM(ledger.delta)` must equal `SUM(grants.remaining)` across **all** grants, expired ones
included — expiry makes credits unspendable, it does not un-grant them. It is returned with
every balance read so drift surfaces where the numbers are used.

**Decisions taken by default** (§5 was never answered; these are reversible and are what the
code does today):

| § | Decision taken | Where |
|---|---|---|
| 5.1 | BYOK is **not** charged credits — only platform-key usage is metered | `meterAiUsage`, `keySource === 'db'` short-circuit |
| 5.2 | Per-model rate card, exact-then-longest-prefix match, unknown models billed at ≥ the flagship rate | `src/lib/billing/credit-rates.ts` |
| 5.6 | Pack bonuses are issued as a **separate `promo` grant**, never merged into the purchase | `redeemCreditPack` |
| 5.7 | Top-ups are **not** gated behind a paid plan; the $25 floor exists as data only | `CREDIT_PACK_MIN_PRICE_CENTS`, unenforced |
| — | Over-consumption becomes **debt**, blocking the next run rather than the current one | `consumeCredits({ allowDebt })`, `settleDebt` |

**Open, and it is a policy question, not a code one:** there is no story yet for an org that
accrues debt and walks away. Nothing caps how deep a single generation can go — one very
large run on an empty balance can create arbitrarily large arrears. Options are a per-run
ceiling, a hard debt limit past which generation is refused outright, or writing bad debt off
at some threshold. Decide before this is exposed to self-serve customers.

**Also open — `MIN_CREDITS_TO_START` is still 1.** The gate therefore stops only a completely
empty org: an org with a single credit passes it, runs a job costing hundreds, and the balance
of the cost becomes debt. That is safe (nothing is given away) but it means arrears are the
normal path rather than the exceptional one. Raising the floor to a realistic figure is a
pricing decision, which is why the code has not picked one.

**Credit exemption.** The platform owner (`DEFAULT_PLATFORM_ADMIN_EMAIL`, extensible via
`CREDIT_EXEMPT_EMAILS`) is neither gated nor charged — they pay the providers directly, so
billing them in their own currency is circular. Exempt usage is still recorded as a zero-delta
`ai_generation_exempt` ledger row, so the cost stays visible without ever touching a grant or
creating arrears. Keyed on identity rather than the platform-admin *role*, because every tenant
seeds its own admins and exempting the role would hand every customer a free AI budget.

Platform-level generation with no tenant (building a custom template) is charged to the
default organization via `resolvePlatformOrgId()` rather than left free — an unmetered path
is exactly the unbounded spend this phase closes. When the platform grows past one
organization, that function is the seam where the acting admin's own org should be resolved.

⚠️ **The rate card is a calibration reference, not a commercial decision.** Tune it against
actual provider spend before charging anyone.

---

### Phase 4 — Payments (Stripe)

**Goal:** actually take money.

1. Add `stripe`. Products/prices per plan × interval. Use Stripe Checkout (hosted) —
   avoids handling card data entirely, which matters given the platform-admin threat model.
2. **Webhooks** → extend the existing `src/app/api/webhooks/` surface (a Vercel webhook
   handler already exists there, so the pattern is established):
   `checkout.session.completed`, `customer.subscription.updated|deleted`,
   `invoice.paid|payment_failed`.
   **Idempotency is mandatory** — persist `stripe_event_id` unique; Stripe retries.
3. **Proration rules** (implement exactly):
   - Upgrade → immediate, prorated charge, **prorated credit grant**, expiry 28d,
     **billing anchor unchanged**.
   - Downgrade → scheduled to next period boundary.
   - Cheaper-but-higher-tier counts as a downgrade.
4. **Dunning:** 7-day grace on failure → auto-downgrade to Free → **disconnect custom
   domains** (we already have the domain routes to do this) → restore on payment.
5. Payment methods: cards only initially. Match the "everything else → Enterprise" stance.
6. **Inline card capture, not a redirect, at the onboarding paywall.** They embed Stripe
   Elements directly in the funnel step (with live per-field validation and native
   iOS/Android card autofill) rather than bouncing to hosted Checkout — losing the
   modal context mid-signup costs conversions. Suggested split: **Elements inline** for
   the onboarding paywall and top-ups; **hosted Checkout** for later plan changes from
   Settings, where context-switching is expected and PCI surface matters more.

**Exit criteria:** full upgrade → downgrade → fail → recover cycle works against Stripe
test mode, driven only by webhooks.

#### Status — server side implemented, not yet run against Stripe

Built: `stripe-client.ts` (client, price catalog, plan ranking), `stripe-service.ts` (customers,
hosted Checkout, in-place plan change, top-up PaymentIntents), `stripe-webhook-service.ts`
(idempotent event processing and all handlers), `/api/webhooks/stripe`, the checkout and
top-up admin routes, and `/api/cron/dunning` registered daily in `vercel.json`.

**Webhooks are the only writer of billing state.** `stripe-service.ts` never applies the
change it just requested, even though the API response contains it — if a response is lost
the customer has still paid, and only a webhook-driven design converges. The same rule puts
credit grants behind `invoice.paid` and `payment_intent.succeeded` rather than behind the
request that started them: credits follow money, never the reverse.

**Idempotency is claim-then-process.** The Stripe event id is the primary key of
`stripe_events`, and processing claims the row with an INSERT — a concurrent redelivery loses
the race and returns without doing the work. Checking for existence and then inserting would
leave a window where two retries both grant the same pack. A handler that throws *un-claims*
the event so Stripe's retry does real work instead of being dropped as a duplicate; a handler
that simply does not recognise the event type stays claimed and ACKs.

Route status codes are a control channel for Stripe's retry logic: 400 for a bad signature
(permanent — retrying cannot fix it), 503 when Stripe is unconfigured, 500 only for genuinely
transient failures, 200 for processed, duplicate and knowingly-ignored alike.

Proration follows §4.3 exactly: upgrades use `create_prorations` with
`billing_cycle_anchor: 'unchanged'` (without the anchor hold, an upgrade resets the cycle and
hands out a free extension); downgrades use `proration_behavior: 'none'` and are recorded
locally as `pending_plan_id` for the UI. Plans are ranked **by price**, which is what makes
"cheaper-but-higher-tier counts as a downgrade" fall out automatically.

Dunning is split: `invoice.payment_failed` opens the 7-day window and marks `past_due`
without dropping the plan, and the daily cron enforces expiry. Repeat failures on the same
invoice do not restart the clock. The plan drop is deliberately not in the webhook — cutting
a customer off on the first failed charge punishes an expired card.

**Since built** (this section previously listed these as outstanding):
- **Inline Elements UI (§4.6).** `stripe-topup-dialog.tsx` consumes the `/topup` client secret
  with `<Elements>` + `<PaymentElement>`; wired into the AI Credits tab. No card data reaches
  our servers. The split in §4.6 now holds: Elements inline for top-ups, hosted Checkout for
  plan changes from Settings.
- **Custom-domain disconnection on downgrade (§4.4).** `disconnectCustomDomains()` runs inside
  the downgrade path in `stripe-webhook-service.ts`. It keeps the `.vercel.app` subdomain so a
  downgraded site stays reachable rather than going dark.

**Still not done — this is the whole of what blocks Phase 4:**
- **Nothing has been exercised against Stripe.** No test-mode account configured, no price ids
  set, no real webhook delivery. Every line above is unproven: it typechecks and it passes unit
  tests against fakes, but no Stripe object has ever been created by it.

  This is not a coding task. It needs, in order: `stripe login`; products and prices created per
  plan × interval; `STRIPE_PRICE_<PLAN>_<INTERVAL>` set for each; `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and `CRON_SECRET` set; then
  `stripe listen --forward-to localhost:3000/api/webhooks/stripe` while walking the upgrade →
  downgrade → fail → recover cycle. The `stripe_events` table and the server logs are the
  evidence — the exit criteria are met when that table shows each event processed exactly once.

  `stripeConfigError()` refuses to start on the two mistakes most likely here: a live key
  outside production, and a webhook secret that is not a `whsec_`.

**Configuration required:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `CRON_SECRET`, and one `STRIPE_PRICE_<PLAN>_<INTERVAL>`
per purchasable plan (e.g. `STRIPE_PRICE_PRO_MONTHLY`). Price ids live in the environment
because they differ between test and live mode — hardcoding them would let a deploy to the
wrong mode silently charge the wrong amounts.

---

### Phase 5 — Cloud credits (run-time currency)

**Goal:** meter what deployed tenant apps actually consume. Hardest phase — needs real
telemetry, so it comes last.

1. **Models:** `UsageRecord (orgId, tenantSlug, appId, resource, quantity, periodStart,
   recordedAt)`, `CloudBalance (orgId, balanceCents, autoTopUpThreshold, autoTopUpAmount)`.
2. **Resource list — ours differs from Hercules'.** Map to what we can *actually*
   measure from Vercel + Neon:

   | Our resource | Source | Notes |
   |---|---|---|
   | Function invocations | Vercel API | Direct analogue |
   | Function duration (GB-hr) | Vercel API | Direct analogue |
   | Data egress | Vercel API | Direct analogue |
   | Database storage | **Neon API** | Neon exposes per-project storage |
   | Database compute-hours | **Neon API** | Neon's own billing unit — better than guessing |
   | AI Gateway passthrough | our own metering | Phase 3 already captures this |

   Do **not** copy Hercules' rate card verbatim — our unit costs are Vercel's and Neon's.
   Rates must be derived from actual COGS + margin, or we sell below cost.
3. **Collector:** scheduled job (Vercel cron) polling Vercel + Neon usage APIs per tenant
   project, writing `UsageRecord`s. Idempotent per (resource, period).
4. **Free allowance × plan multiplier** (Pro's "20× cloud usage"); overage debits
   `CloudBalance`. Balance **may go negative** — matching Hercules, and correct, since
   shutting an app off mid-month over a few cents is worse than carrying a small debt.
5. **Alerts at 50 / 75 / 90 / 100%**, plus auto top-up at threshold.

**Exit criteria:** a deployed tenant app's real Vercel/Neon consumption appears in a
per-app, per-day usage table that reconciles against the providers' own dashboards.

#### Status — decided, still not built *(revised 2026-08-18)*

**§5.3 is answered: we resell.** That was already true in practice — the platform
provisions Neon databases and Vercel projects on our accounts — so the phase is a billing
system, not a reporting one, and the models/collector/UI below are the right shape.

A first collector was written and then withdrawn. It polled `GET /v9/projects/{id}` and
read a `.metrics` field that endpoint does not return, and it wrote to `usage_records` and
`cloud_balances`, neither of which is declared in the zmodel or created by any runtime
helper — every insert would have failed with 42P01. `/api/cron/cloud-credits` now answers
200 with `metered: false` and carries the three missing pieces in its header comment:
a real usage source, the storage, and a rate card. Note also that `CRON_SECRET` is not set
in production, so the cron cannot run at all until that is fixed.

What follows is unchanged and still accurate as the plan.

#### Original status note — not started, and deliberately so

No `UsageRecord`, no `CloudBalance`, no collector. The Cloud Credits tab is an honest empty
state rather than a mock.

**Blocked on §5.3, which is a business decision.** If we resell Vercel and Neon capacity this
phase is a billing system: rate cards derived from our COGS, balances that can go negative,
auto top-up, dunning. If tenants connect their own provider accounts it is a reporting system:
read the APIs, show the numbers, charge nothing. The models, the collector and the entire UI
differ between those two. Starting before the answer means building one and discarding it.

Worth noting the answer is partly forced: the platform currently provisions Neon databases and
Vercel projects **on our accounts**, so today we are already reselling — we simply are not
measuring or charging for it. That is the unbounded cost this phase exists to close, and it is
the one remaining uncapped spend now that AI is metered.

---

### Phase 6 — Billing UI

Mirror the IA (it is genuinely good): **Settings → Billing → [Plan | AI Credits | Cloud Credits | Invoices]**.

- **Plan tab:** Monthly/Yearly toggle w/ "Save 15%", tier cards, current-plan marker, upgrade CTA.
- **AI Credits tab:** big balance, `$25/$50/$100/Custom` top-up row, auto-reload setup,
  **Monthly credit grants** breakdown (plan vs add-on vs total), and
  **Usage history | Grants** tabs — the Grants table showing *Start / Expires / Amount /
  Remaining* is what makes expiry legible instead of infuriating. Do not skip it.
- **Cloud Credits tab:** balance + Add balance, auto-reload, and the per-resource
  **Included vs Additional** usage table, filterable by **app / date range / grouped by day**.
- Reuse existing components: `TenantAiProviderForm` is the closest existing pattern for
  the tab layout; `AppRow` for per-app usage rows.

#### Status — built, two gaps

`billing-panel.tsx` renders the four-tab IA under Settings → Billing, resolved from the tenant
via `tenant-billing-tab.tsx` (billing belongs to the Organization, not the Tenant).

Done: Plan tab with the monthly/yearly toggle and current-plan marker, driving hosted Checkout;
AI Credits with the balance, the arrears banner, plan/purchase/promo grant breakdown, the
`$25/$50/$100` top-up row backed by inline Elements, and the **Grants table (Start / Expires /
Amount / Remaining)** the roadmap said not to skip; Invoices from Stripe.

**Cloud Credits is deliberately an empty state, not a mock.** Phase 5 has no collector, so
there is no usage data; a populated table there would imply metering that does not exist.

**Not done:**
- **Auto-reload UI.** Nothing in the panel configures it, because the underlying behaviour
  does not exist either — see the Phase 3 note below. An attempt at the controls was
  written and removed on 2026-08-18: `autoReload` was initialised false with no control
  ever setting it, so the whole subtree was unreachable and rendered as a permanent
  "Auto-reload: Disabled" line promising a feature with no column, no endpoint and no
  stored payment method behind it. Building it needs those three things first.
- **Usage history tab.** The AI Credits tab shows grants but not consumption. The ledger holds
  every debit with model, tokens and reason, so this is a table over data that already exists.

---

### Phase 7 — Onboarding & funnel

1. **Prompt-first landing:** single textarea, no signup wall, → generate → *then* auth.
   Our `app-pack-generator.ts` already does natural-language → app generation, so the
   hard part exists; this is a funnel re-order, not new capability.
   Add **quick-start pills** (our equivalents of CRM/ERP/HR portal) that pre-fill the
   prompt — we already have a template catalog (`template-catalog.ts`) to source them from.

2. **Signup carousel** — port the 6-step sequence from §1.8, preserving the ordering:
   welcome → *what's built in* → *branding/custom domain* → **payments/revenue** →
   attribution → paywall. Step 4 must stay immediately before the paywall; that
   adjacency is the conversion argument, not decoration.
   - Our step 2 grid should list what we actually ship (Vercel hosting, Neon Postgres,
     Google auth, AI generation, RBAC/security groups, multi-app suites) — not their tile set.

3. **Attribution capture** (step 5) — new `OrgAttribution { orgId, channel, capturedAt }`.
   Trivial to build, and the only way to see word-of-mouth and LLM-referred signups.
   Do this even if the rest of the carousel slips.

4. **Paywall placement — recommended: mid-onboarding, skippable.**
   Take the card at peak intent, but `Skip for now` must be a first-class, unpenalised
   path straight to a working Free account. Hard-gating before first value would be
   strictly worse for us than for them: we have no free published-app tier story yet.

5. **Publish flow:** free `[app].<our-domain>` subdomain first; custom domain as the
   paid upgrade moment. Our per-app domain routes already exist.

6. **Auth failure page** — branded, with support escalation, instead of a raw error.
   Applies to our existing Google OAuth flow regardless of the rest of this phase.

7. **Landing page arc** — follow the §1.12 ordering (capability → proof → objection-handling
   → CTA). Sections 5 and 6 ("will it scale?", "is it secure?") are the objections our
   buyer raises about an AI-generated app, and we can answer both with things we already
   have: Vercel serverless for scale, and our security-groups/RBAC work for governance.
   Keep the "No credit card required" promise honest by keeping the paywall skippable (§1.12).

8. **SEO assets** (deliberate, high-ROI, low-risk):
   - `/changelog/*` — one page per shipped feature, dated. They have 122.
   - `/utilities/*` — free standalone tools, no auth. Cheap to build, ranks well.
   - `llms.txt` docs index — trivially cheap, makes the product legible to AI assistants
     that increasingly mediate discovery.
   - `/status` — uptime page; needed to back any uptime claim we make.
   - FAQ block — the 7 questions in §1.12 map almost 1:1 onto our product.
   - Case-study template: **industry pill + two hard metrics** (§1.11), populated only
     with our own customers' verified numbers.

9. **MCP server (`/mcp`) — treat as a distribution channel, not a feature.**
   Exposing "create/build/manage a tenant app" as MCP tools would let ChatGPT, Claude and
   Cursor drive our platform directly. Two reasons this is unusually cheap for us:
   our provisioning surface is *already* a clean REST API (`admin/tenants/**`), and we
   already consume MCP servers in this repo, so the shape is familiar. Listing in the
   ChatGPT Apps directory is the actual acquisition lever. Scope after Phases 1–3, since
   it must respect entitlements and credit balance like any other client.

10. **Affiliates programme** — deferred, but note it early: referral attribution needs an
    `Organization.referredBy` field, and retrofitting attribution after launch loses the
    cohort. Add the column in Phase 1 even if the programme ships much later.

#### Status — partly done *(revised 2026-08-18)*

**Item 1 — done.** The `home` page in `page-catalog.ts` is now `marketing_hero` →
`customer_proof` → `product_showcase`: a single prompt box with quick-start pills sourced
from the template catalogue, no signup wall in front of it. `/` answers 200 to an anonymous
visitor; it previously 307'd into a sign-in wall, so the marketing page could not be reached
at all. `customer_proof` renders nothing until real customers agree to appear — an empty
section is honest, invented testimonials are not.

**Item 3 — done, and this was the time-sensitive one.** `OrgAttribution { orgId, channel,
capturedAt }` exists with `orgId` unique and a cascade to `Organization`. The capture is
live: `POST /api/admin/organizations` takes an explicit `channel`, falls back to
`utm_source`, and floors at `admin_console` rather than `unknown`. Worth recording that the
model shipped a week before the capture did, and in between every row read the literal
`unknown` — the column existing is not the same as the cohort being recorded.

**Item 8 — blocked, and not on effort.** `llms.txt` is written at `docs/llms.txt` but is not
served: `/llms.txt` answers 307 into `?redirect_reason=auth_required`. `proxy.ts` gates every
non-API path on `PUBLIC_SLUGS = {dashboard, terms-of-service, privacy-policy}` plus the root,
so `/changelog`, `/utilities` and `/status` will each behave identically once written. Widen
that set — or serve these from `public/` outside the matcher — before writing any of the
pages, or the work is invisible to exactly the crawlers it targets.

**Items 2, 4, 5, 6, 9 — not started.** Signup carousel, paywall placement, publish flow,
branded auth-failure page, MCP server.

**Item 10 — column only.** `Organization.referredBy` exists and is still never written; the
affiliate programme itself is deferred. Attribution (item 3) covers the marketing channel,
not the referring affiliate — these are two different fields and only one of them is live.

**Adjacent work already done, outside this roadmap.** Item 1 assumes the template catalogue is
what pre-fills the quick-start pills. That catalogue now also carries an assistant persona per
template, and a provisioned app is stamped with its template identity at deploy time — so an
app generated from the funnel arrives with an assistant that knows its industry rather than a
generic one. Custom templates built by the admin chat tool are generated from the
administrator's own brief and are selectable in the Create New App wizard.

---

## 4. Sequencing summary

*Revised 2026-08-18, against the deployed tree at `608eedb`.*

| Phase | Deliverable | Status | What remains |
|---|---|---|---|
| 1 | Organization layer | **Done** | — |
| 2 | Plans + entitlements | **Done** | — |
| 3 | AI credits + metering | **Done** | — (both policy calls made and shipped) |
| 4 | Stripe | **Code done, not configured** | Credentials in Vercel, then the test-mode run |
| 5 | Cloud credits | **Decided, not built** | Everything. §5.3 answered: we resell. |
| 6 | Billing UI | **Done bar two tabs** | Auto-reload UI (needs Phase 4), usage history |
| 7 | Funnel/SEO | **Partly done** | Items 2, 4, 5, 6, 9; item 8 blocked by the proxy |

**Where the work actually is now.** Phases 1–3 and 6 are code-complete, and Phase 3's two
open policy calls are closed: `DEFAULT_DEBT_CEILING = 50` and the per-job `CREDIT_FLOORS`
(chat 1 … tenant provisioning 30) are in `credit-service.ts`.

**Phase 4 is further from working than "unproven" suggested.** Production carries 52
environment variables and *not one of them is a Stripe key* — no secret key, no webhook
secret, no price ids. `stripeReadiness()` therefore reports not-ready, and every payment
path in the deployed app is inert: plan upgrades, top-ups, invoices. `CRON_SECRET` is
absent too, so `/api/cron/dunning` has answered 503 on every scheduled run since it
shipped — past-due downgrades have never once been enforced. This is still configuration
rather than code, but it is a longer list than one test run.

**Phase 5 is unblocked and untouched.** §5.3 is answered — we resell, which was already
true in practice since tenants are provisioned onto our Vercel and Neon accounts. The
collector written for it polled a Vercel field that does not exist and wrote to two tables
declared nowhere, so it now stands as a documented stub that returns `metered: false`.
`UsageRecord` and `CloudBalance` are still not in the zmodel. This remains the one
uncapped spend on the platform.

**Phase 7 is no longer "not started".** Items 1 and 3 shipped:

- **Item 1 — prompt-first landing.** `marketing_hero` + `customer_proof` +
  `product_showcase` are the `home` page in `page-catalog.ts`, and `/` now answers 200 to
  an anonymous visitor instead of redirecting into a sign-in wall. The proof block is
  deliberately empty until real customers agree to appear.
- **Item 3 — attribution capture.** `OrgAttribution` exists with a real channel reaching
  the row; the time-sensitive item is closed.

**Item 8 has a structural blocker worth knowing before anyone starts it.** `llms.txt` is
written (`docs/llms.txt`) but not served: `/llms.txt` answers 307 into the sign-in
redirect. `proxy.ts` gates on `PUBLIC_SLUGS = {dashboard, terms-of-service, privacy-policy}`
plus the root, so *every* asset this item plans — `/changelog`, `/utilities`, `/status` —
will be auth-gated the same way. One change to that set unblocks the whole item; without
it, writing the pages accomplishes nothing.

---

## 5. Open decisions (need a call before Phase 3)

1. **BYOK credit policy** — if a tenant supplies their own OpenAI/Gateway/Zen key, do we
   charge AI credits at all? (Recommend: no credits, flat platform fee. It is honest and
   it is a differentiator Hercules cannot match.)
2. **Credit ↔ token rate card** — per-model, and does it change when the tenant's chosen
   model changes? (Our multi-provider design makes cost genuinely variable per model.)
3. ~~**Who owns the tenant's Neon/Vercel cost**~~ — **ANSWERED 2026-08-18: we resell.**
   Phase 5 is a billing system. The answer was partly forced: tenants are already
   provisioned onto our accounts, so we resell today and simply do not measure it.
4. **Currency/tax** — Stripe Tax, and are we invoicing in USD only?
5. **Existing `metadata.config.license.*`** — migrate into the new Subscription model, or
   leave the vestigial field and ignore it? (Recommend: migrate then delete, to avoid two
   competing sources of truth.)
6. **Top-up bonus policy** — do we run a first-purchase bonus at all, and does it taper
   like theirs (§1.9) or invert into a true volume discount? Their curve gives *less*
   value per dollar as basket size grows, which only makes sense as acquisition spend.
   Decide before Phase 3 ships, since it shapes the `CreditGrant.source` taxonomy.
7. **Do we gate top-ups behind a paid plan** (their $25 floor = the Pro price), or let
   Free users buy credits? Gating drives subscriptions; not gating drives usage revenue
   from users who will never subscribe.

---

## 6. Sources

- `https://hercules.app/sitemap.xml` — 177 URLs
- `https://hercules.app/docs/llms.txt` — 89-page docs index
- `https://hercules.app/docs/platform/billing/{plans,ai-credits,cloud-credits}.md`
- `https://hercules.app/docs/apps/{quickstart,publish/how-to-publish}.md`
- Authenticated UI screenshots: billing tabs (Plan / AI Credits / Cloud Credits), the
  6-step signup carousel, the onboarding paywall + inline Stripe form, the "Get more AI
  Credits" top-up sheet incl. bonus tiers and minimum-amount validation, the sign-in
  error state, the homepage narrative sections + FAQ, and the footer navigation
  (which exposed /mcp, /affiliates, /forum, /status — none of them present in sitemap.xml)

*Rates and plan prices recorded as observed on 2026-08-16; treat as a calibration
reference, not a target — our COGS are Vercel's and Neon's, not theirs.*
