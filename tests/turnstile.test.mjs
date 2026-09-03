// Verifie uniquement les rejets rapides qui n'appellent pas le reseau
// (siteverify de Cloudflare) : cette partie est la seule qu'on peut tester
// sans mock d'API externe, et c'est la ou une regression serait la plus
// silencieuse (le formulaire semblerait fonctionner en dev sans jamais
// verifier Turnstile). Le succes reel (appel siteverify) reste couvert
// manuellement en pre-prod, pas ici.
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
