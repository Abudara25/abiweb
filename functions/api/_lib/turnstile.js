import { clientIp } from './rate-limit.js';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function rejection(debug) {
  return new Response(JSON.stringify({ error: 'turnstile_failed', debug }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Renvoie une Response 403 si le jeton Turnstile est absent/invalide, sinon null.
export async function enforceTurnstile(request, env, token, expectedAction) {
  const hostnames = (env.TURNSTILE_HOSTNAMES || '')
    .split(',')
    .map((hostname) => hostname.trim())
    .filter(Boolean);

  if (typeof token !== 'string' || token.length === 0 || token.length > 2048 || hostnames.length === 0) {
    return rejection({ stage: 'pre-check', tokenType: typeof token, tokenLen: token && token.length, hostnames });
  }

  let result;
  try {
    const r = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: token,
        remoteip: clientIp(request),
      }),
    });
    if (!r.ok) throw new Error(`siteverify ${r.status}`);
    result = await r.json();
  } catch (err) {
    return rejection({ stage: 'fetch', message: err && err.message });
  }

  if (!result.success || result.action !== expectedAction || !hostnames.includes(result.hostname)) {
    return rejection({ stage: 'check', result, expectedAction, hostnames });
  }

  return null;
}
