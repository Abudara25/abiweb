const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 1000;
const submissions = new Map();

export const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export function invalidFields(body, limits) {
  return Object.entries(limits).filter(([field, max]) => {
    const value = body[field];
    return value != null && (typeof value !== 'string' || value.length > max);
  }).map(([field]) => field);
}

export function validList(value, maxItems, maxLength) {
  return value === undefined || (Array.isArray(value) && value.length <= maxItems &&
    value.every((item) => typeof item === 'string' && item.length <= maxLength));
}

export function validSubmissionId(value) {
  return value === undefined || (typeof value === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(value));
}

// Protection des retries sur une même instance uniquement : un stockage durable
// partagé reste nécessaire pour garantir l'idempotence entre plusieurs Workers.
export async function withIdempotency(request, scope, submissionId, data, operation) {
  if (!submissionId) return operation();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)));
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const now = Date.now();
  for (const [key, entry] of submissions) {
    if (!entry.pending && entry.expiresAt <= now) submissions.delete(key);
  }
  const key = JSON.stringify([scope, clientIp(request), submissionId]);
  const previous = submissions.get(key);
  if (previous) {
    if (previous.fingerprint !== fingerprint) return json({ error: 'submission_conflict' }, 409);
    return (await previous.promise).clone();
  }
  // Ne jamais évincer une soumission active ou réussie pour faire entrer un
  // nouvel identifiant : cela permettrait un deuxième envoi avant l'expiration.
  if (submissions.size >= MAX_CACHE_ENTRIES) {
    const response = json({ error: 'submission_busy' }, 503);
    response.headers.set('Retry-After', '10');
    return response;
  }
  const entry = { fingerprint, pending: true, expiresAt: now + CACHE_TTL_MS };
  entry.promise = Promise.resolve().then(operation);
  submissions.set(key, entry);
  try {
    const response = await entry.promise;
    entry.pending = false;
    entry.expiresAt = Date.now() + CACHE_TTL_MS;
    if (!response.ok && submissions.get(key) === entry) submissions.delete(key);
    return response.clone();
  } catch (error) {
    entry.pending = false;
    if (submissions.get(key) === entry) submissions.delete(key);
    throw error;
  }
}

// Cloudflare continue ces opérations après la réponse HTTP. Sans contexte
// Worker (tests/appel direct), on les attend pour ne pas les abandonner.
export function continueInBackground(ctx, task) {
  const guarded = task.catch((error) => console.error('Background task failed:', error));
  if (ctx?.waitUntil) {
    ctx.waitUntil(guarded);
    return undefined;
  }
  return guarded;
}
import { clientIp } from './rate-limit.js';
