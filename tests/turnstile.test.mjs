// Aucun appel externe : succès, rejets et pannes de siteverify sont simulés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enforceTurnstile } from '../functions/api/_lib/turnstile.js';

const fakeRequest = { headers: { get: () => null } };
const envWithHostnames = { TURNSTILE_HOSTNAMES: 'www.abiweb.fr,abiweb.fr', TURNSTILE_SECRET: 'x' };

async function statusOf(promise) {
  const res = await promise;
  return res ? res.status : null;
}

test('rejette un token absent', async () => {
  assert.equal(await statusOf(enforceTurnstile(fakeRequest, envWithHostnames, undefined, 'contact')), 403);
});

test('rejette un token vide', async () => {
  assert.equal(await statusOf(enforceTurnstile(fakeRequest, envWithHostnames, '', 'contact')), 403);
});

test('rejette un token non-string', async () => {
  assert.equal(await statusOf(enforceTurnstile(fakeRequest, envWithHostnames, 12345, 'contact')), 403);
});

test('rejette un token anormalement long (> 2048 caracteres)', async () => {
  const tropLong = 'a'.repeat(2049);
  assert.equal(await statusOf(enforceTurnstile(fakeRequest, envWithHostnames, tropLong, 'contact')), 403);
});

test('rejette si TURNSTILE_HOSTNAMES n\'est pas configure (fail-closed)', async () => {
  const envSansHostnames = { TURNSTILE_SECRET: 'x' };
  assert.equal(await statusOf(enforceTurnstile(fakeRequest, envSansHostnames, 'un-token-plausible', 'contact')), 403);
});

test('accepte uniquement le succès pour le domaine et l’action attendus', async (t) => {
  let result = { success: true, action: 'contact', hostname: 'abiweb.fr' };
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(init.body.get('secret'), 'x');
    assert.equal(init.body.get('response'), 'valid-token');
    return Response.json(result);
  });
  assert.equal(await statusOf(enforceTurnstile(fakeRequest, envWithHostnames, 'valid-token', 'contact')), null);
  for (const invalid of [
    { success: true, action: 'brief', hostname: 'abiweb.fr' },
    { success: true, action: 'contact', hostname: 'other.example' },
    { success: false, action: 'contact', hostname: 'abiweb.fr' },
    { success: 'true', action: 'contact', hostname: 'abiweb.fr' },
    null,
  ]) {
    result = invalid;
    assert.equal(await statusOf(enforceTurnstile(fakeRequest, envWithHostnames, 'valid-token', 'contact')), 403);
  }
});

test('les erreurs HTTP, JSON et réseau sont refusées', async (t) => {
  let mode = 'http';
  t.mock.method(globalThis, 'fetch', async () => {
    if (mode === 'http') return new Response('Unavailable', { status: 503 });
    if (mode === 'json') return new Response('not json');
    throw new Error('network unavailable');
  });
  for (const value of ['http', 'json', 'network']) {
    mode = value;
    assert.equal(await statusOf(enforceTurnstile(fakeRequest, envWithHostnames, 'valid-token', 'contact')), 403);
  }
});

test('le délai de vérification interrompt une requête qui ne répond pas', async (t) => {
  const controller = new AbortController();
  t.mock.method(AbortSignal, 'timeout', (duration) => {
    assert.equal(duration, 10000);
    return controller.signal;
  });
  t.mock.method(globalThis, 'fetch', (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  const verification = enforceTurnstile(fakeRequest, envWithHostnames, 'valid-token', 'contact');
  controller.abort(new DOMException('Timed out', 'TimeoutError'));
  assert.equal(await statusOf(verification), 403);
});
