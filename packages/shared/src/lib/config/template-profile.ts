/**
 * Template identity and assistant persona, as seen by a running app.
 *
 * ## The problem this solves
 *
 * A provisioned tenant app used to have no idea what it was. `getTenantConfig()`
 * could answer "what am I called" — slug, display name, description — but
 * nothing could answer "what am I". The template picked the app's pages, nav
 * and colours at provisioning time and was then discarded: the deploy step
 * resolved it only to derive wallet environment variables and threw the rest
 * away.
 *
 * The visible consequence was the AI assistant. Its system prompt was built
 * from a hardcoded corpus describing one specific nightclub, and every app
 * built from every template introduced itself as that business — including
 * unconditional instructions to quote money in IDR and to highlight break-even
 * coverage, which reached tenants that had neither.
 *
 * ## How the identity gets here
 *
 * At deploy time `buildEnvVarsForProject()` resolves the template and writes:
 *
 *   NEXT_PUBLIC_TEMPLATE_ID     — the template id, client-readable
 *   NEXT_PUBLIC_TEMPLATE_LABEL  — its human label, client-readable
 *   TEMPLATE_PROFILE            — the assistant persona as JSON, server-only
 *
 * The profile is server-only because it is prompt material, not UI copy, and
 * because it is large enough that inlining it into the client bundle would be
 * waste. Existing apps pick all three up on their next redeploy; until then
 * every function here degrades to a neutral profile rather than to somebody
 * else's business.
 */

/** Environment variable carrying the serialized assistant profile. */
export const TEMPLATE_PROFILE_ENV_KEY = 'TEMPLATE_PROFILE';

export interface AssistantProfile {
  role: string;
  domain: string;
  currency: string;
  keyMetrics: string[];
  capabilities: string[];
  answerStyle: string[];
}

export interface TemplateIdentity {
  /** Template id, or empty string when this app predates template stamping. */
  id: string;
  /** Human label, or empty string when unknown. */
  label: string;
}

/**
 * What an app is when it has not been told what it is.
 *
 * Says nothing about any industry on purpose. The previous fallback described
 * a specific nightclub's finances, so an app with no configuration confidently
 * introduced itself as a business it had nothing to do with. Being vague is
 * recoverable; being wrong is not.
 */
export const NEUTRAL_ASSISTANT_PROFILE: AssistantProfile = {
  role: 'business operations assistant',
  domain: 'general business operations',
  currency: 'USD',
  keyMetrics: [],
  capabilities: [
    'answer questions about the data in this application',
    'summarise records and recent activity',
    'help navigate the available sections',
  ],
  answerStyle: [
    'Answer from the data in this application; say so plainly when it is not there.',
    'State the period a figure covers.',
    'Be concise and specific.',
  ],
};

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const strings = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '');
  return strings.length > 0 ? strings : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Parse a serialized profile, filling anything missing from the neutral one.
 *
 * Field-by-field rather than all-or-nothing: a template that specifies a role
 * and currency but no key metrics should keep its role and currency. An older
 * stored custom template with a partial profile is the normal case, not an
 * error case.
 */
export function parseAssistantProfile(raw: string | undefined | null): AssistantProfile {
  if (!raw || !raw.trim()) return NEUTRAL_ASSISTANT_PROFILE;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // A malformed value must not take the assistant down — an app with a broken
    // profile should still answer, just generically.
    console.warn('[template-profile] TEMPLATE_PROFILE is not valid JSON; using the neutral profile');
    return NEUTRAL_ASSISTANT_PROFILE;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return NEUTRAL_ASSISTANT_PROFILE;
  }

  const source = parsed as Record<string, unknown>;
  return {
    role: readString(source.role) ?? NEUTRAL_ASSISTANT_PROFILE.role,
    domain: readString(source.domain) ?? NEUTRAL_ASSISTANT_PROFILE.domain,
    currency: readString(source.currency) ?? NEUTRAL_ASSISTANT_PROFILE.currency,
    keyMetrics: readStringArray(source.keyMetrics) ?? NEUTRAL_ASSISTANT_PROFILE.keyMetrics,
    capabilities: readStringArray(source.capabilities) ?? NEUTRAL_ASSISTANT_PROFILE.capabilities,
    answerStyle: readStringArray(source.answerStyle) ?? NEUTRAL_ASSISTANT_PROFILE.answerStyle,
  };
}

/** This deployment's template identity. Empty fields mean "not stamped yet". */
export function getTemplateIdentity(): TemplateIdentity {
  return {
    id: process.env.NEXT_PUBLIC_TEMPLATE_ID?.trim() || '',
    label: process.env.NEXT_PUBLIC_TEMPLATE_LABEL?.trim() || '',
  };
}

/** This deployment's assistant persona. Server-side only — reads TEMPLATE_PROFILE. */
export function getAssistantProfile(): AssistantProfile {
  return parseAssistantProfile(process.env[TEMPLATE_PROFILE_ENV_KEY]);
}
