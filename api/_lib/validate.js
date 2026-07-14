// Server-side validation for the panel application.
//
// The form validates in the browser too, but that is only there to give fast
// feedback. Anything can POST to /api/apply, so this is the rule that actually
// holds. Every field is re-checked and clamped here.

export const SPECIALTIES = [
  'Level design',
  'Systems design',
  'Combat / game feel',
  'Narrative & quest design',
  'UX & onboarding',
  'Game economy',
  'QA & playtest lead',
  'Technical / engine',
  'AI & NPC behaviour',
  'Art direction',
  'Other',
];

export const HEARD_FROM = [
  'Referral from a panelist',
  'X / Twitter',
  'LinkedIn',
  'Reddit',
  'Discord',
  'GameDev conference',
  'Search',
  'Direct outreach',
  'Other',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const str = (v) => (typeof v === 'string' ? v.trim() : '');

/** Cap free text so a single submission can't dump megabytes into the table. */
const cap = (v, n) => str(v).slice(0, n);

function optionalUrl(value, field, errors, { hostContains } = {}) {
  const v = str(value);
  if (!v) return null;

  let candidate = v;
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    errors[field] = 'Enter a valid URL.';
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    errors[field] = 'Enter a valid http(s) URL.';
    return null;
  }

  if (hostContains && !parsed.hostname.toLowerCase().includes(hostContains)) {
    errors[field] = `That doesn't look like a ${hostContains} URL.`;
    return null;
  }

  return parsed.toString();
}

function intInRange(value, field, errors, { min, max, required = false }) {
  const raw = str(value);
  if (!raw) {
    if (required) errors[field] = 'Required.';
    return null;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    errors[field] = 'Enter a number.';
    return null;
  }
  if (n < min || n > max) {
    errors[field] = `Enter a number between ${min} and ${max}.`;
    return null;
  }
  return Math.round(n);
}

/**
 * @returns {{ ok: true, value: object } | { ok: false, errors: Record<string,string> }}
 */
export function validateApplication(input) {
  const errors = {};
  if (!input || typeof input !== 'object') {
    return { ok: false, errors: { _: 'Malformed request.' } };
  }

  const full_name = cap(input.full_name, 120);
  if (!full_name) errors.full_name = 'Required.';
  else if (full_name.length < 2) errors.full_name = 'Enter your full name.';

  const email = cap(input.email, 200).toLowerCase();
  if (!email) errors.email = 'Required.';
  else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';

  const shipped_credits = cap(input.shipped_credits, 4000);
  if (!shipped_credits) {
    errors.shipped_credits = 'Required — this is the main thing we screen on.';
  } else if (shipped_credits.length < 15) {
    errors.shipped_credits = 'Tell us the titles and your role on them.';
  }

  // Ranked, deduped, max 3, and only values we actually offer.
  const rawSpecs = Array.isArray(input.specialties) ? input.specialties : [];
  const specialties = [];
  for (const s of rawSpecs) {
    const v = str(s);
    if (v && SPECIALTIES.includes(v) && !specialties.includes(v)) specialties.push(v);
    if (specialties.length === 3) break;
  }
  if (!specialties.length) errors.specialties = 'Pick at least one.';

  const heard_from_raw = cap(input.heard_from, 60);
  const heard_from = HEARD_FROM.includes(heard_from_raw) ? heard_from_raw : null;

  const value = {
    full_name,
    email,
    country: cap(input.country, 80) || null,
    linkedin_url: optionalUrl(input.linkedin_url, 'linkedin_url', errors, { hostContains: 'linkedin' }),
    portfolio_url: optionalUrl(input.portfolio_url, 'portfolio_url', errors),
    github_url: optionalUrl(input.github_url, 'github_url', errors, { hostContains: 'github' }),
    video_url: optionalUrl(input.video_url, 'video_url', errors),
    specialties,
    years_experience: intInRange(input.years_experience, 'years_experience', errors, { min: 0, max: 60 }),
    hours_per_week: intInRange(input.hours_per_week, 'hours_per_week', errors, { min: 1, max: 60 }),
    hourly_rate_usd: intInRange(input.hourly_rate_usd, 'hourly_rate_usd', errors, { min: 0, max: 2000 }),
    shipped_credits,
    heard_from,
    notes: cap(input.notes, 4000) || null,
  };

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value };
}

/**
 * The honeypot is a field hidden from humans via CSS. Real users never see it,
 * so they never fill it. Naive bots fill every input they find. If it has any
 * content, treat the submission as spam.
 */
export function isSpam(input) {
  return Boolean(str(input?.company_website));
}
