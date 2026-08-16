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

---

## 4. Sequencing summary

| Phase | Deliverable | Blocks | Risk |
|---|---|---|---|
| 1 | Organization layer | everything | Low — additive |
| 2 | Plans + entitlements | 3,4 | Low — Free default breaks nothing |
| 3 | **AI credits + metering** | 4 | **Medium — highest value; caps unbounded AI cost** |
| 4 | Stripe | 5 | Medium — webhook idempotency is the trap |
| 5 | Cloud credits | — | **High — depends on external usage APIs** |
| 6 | Billing UI | — | Low |
| 7 | Funnel/SEO | — | Low — parallelisable with everything |

**Recommended first cut:** Phases 1 → 2 → 3. That yields a working plan/entitlement system
and *caps AI spend*, which is the currently-unbounded cost, without needing Stripe or
usage telemetry. Phase 5 is the only phase gated on third-party data availability and
should be scoped only after 1–3 are live.

---

## 5. Open decisions (need a call before Phase 3)

1. **BYOK credit policy** — if a tenant supplies their own OpenAI/Gateway/Zen key, do we
   charge AI credits at all? (Recommend: no credits, flat platform fee. It is honest and
   it is a differentiator Hercules cannot match.)
2. **Credit ↔ token rate card** — per-model, and does it change when the tenant's chosen
   model changes? (Our multi-provider design makes cost genuinely variable per model.)
3. **Who owns the tenant's Neon/Vercel cost** — we resell, or they connect their own
   accounts? This determines whether Phase 5 is *billing* or merely *reporting*.
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
