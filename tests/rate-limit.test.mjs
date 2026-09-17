// clientIp() choisit quelle IP faire confiance pour le plafonnement anti-spam
// (voir le commentaire dans rate-limit.js sur pourquoi cf-connecting-ip prime
// sur x-forwarded-for, falsifiable). Les tentatives par IP et les envois
// validés ont des compteurs distincts, avec une fenêtre glissante.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientIp, checkRateLimit } from '../functions/api/_lib/rate-limit.js';

function fakeRequest(headers) {
  const map = new Map(Object.entries(headers));
  return { headers: { get: (name) => map.get(name) ?? null } };
}

test('clientIp priorise cf-connecting-ip (edge Cloudflare, non falsifiable)', () => {
  const req = fakeRequest({
    'cf-connecting-ip': '1.1.1.1',
    'x-forwarded-for': '2.2.2.2',
    'x-real-ip': '3.3.3.3',
  });
  assert.equal(clientIp(req), '1.1.1.1');
});

test('clientIp retombe sur x-forwarded-for (premiere IP de la liste) si absent', () => {
  const req = fakeRequest({ 'x-forwarded-for': '2.2.2.2, 9.9.9.9' });
  assert.equal(clientIp(req), '2.2.2.2');
});

test('clientIp retombe sur x-real-ip en dernier recours', () => {
  const req = fakeRequest({ 'x-real-ip': '3.3.3.3' });
  assert.equal(clientIp(req), '3.3.3.3');
});

test('clientIp renvoie "inconnue" sans aucun en-tete', () => {
  assert.equal(clientIp(fakeRequest({})), 'inconnue');
});

test('checkRateLimit autorise jusqu\'a 5 envois par IP puis bloque le 6e', () => {
  const ip = `test-ip-${Date.now()}-a`; // IP unique pour ne pas heriter d'un etat d'un autre test
  const req = fakeRequest({ 'cf-connecting-ip': ip });

  for (let i = 0; i < 5; i += 1) {
    const result = checkRateLimit(req);
    assert.equal(result.limited, false, `envoi ${i + 1}/5 devrait passer`);
  }

  const sixth = checkRateLimit(req);
  assert.equal(sixth.limited, true);
  assert.ok(sixth.retryAfter > 0);
});

test('checkRateLimit isole les compteurs par IP', () => {
  const ipA = `test-ip-${Date.now()}-b1`;
  const ipB = `test-ip-${Date.now()}-b2`;
  const reqA = fakeRequest({ 'cf-connecting-ip': ipA });
  const reqB = fakeRequest({ 'cf-connecting-ip': ipB });

  for (let i = 0; i < 5; i += 1) checkRateLimit(reqA);
  assert.equal(checkRateLimit(reqA).limited, true, 'IP A doit etre plafonnee');
  assert.equal(checkRateLimit(reqB).limited, false, 'IP B ne doit pas heriter du plafond de IP A');
});

test('la fenêtre par IP expire et Retry-After diminue', async (t) => {
  const limits = await import('../functions/api/_lib/rate-limit.js?ip-expiration');
  let now = 1000000;
  t.mock.method(Date, 'now', () => now);
  const req = fakeRequest({ 'cf-connecting-ip': 'expiry-client' });
  for (let i = 0; i < 5; i++) assert.equal(limits.checkRateLimit(req).limited, false);
  assert.equal(limits.checkRateLimit(req).retryAfter, 600);
  now += 599000;
  const response = limits.enforceRateLimit(req);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '1');
  now += 1000;
  assert.equal(limits.checkRateLimit(req).limited, false);
});

test('le plafond global accepte 60 envois validés puis expire', async (t) => {
  const limits = await import('../functions/api/_lib/rate-limit.js?global-expiration');
  let now = 2000000;
  t.mock.method(Date, 'now', () => now);
  for (let i = 0; i < 100; i++) limits.checkRateLimit(fakeRequest({ 'cf-connecting-ip': `attempt-${i}` }));
  for (let i = 0; i < 60; i++) assert.equal(limits.checkSubmissionLimit().limited, false);
  const rejection = limits.enforceSubmissionLimit();
  assert.equal(rejection.status, 429);
  assert.equal(rejection.headers.get('Retry-After'), '600');
  now += 600000;
  assert.equal(limits.checkSubmissionLimit().limited, false);
});

test('le nombre de compteurs IP est borné sans effacer une IP active', async (t) => {
  const limits = await import('../functions/api/_lib/rate-limit.js?ip-capacity');
  let now = 3000000;
  t.mock.method(Date, 'now', () => now);
  for (let i = 0; i < 5000; i++) {
    assert.equal(limits.checkRateLimit(fakeRequest({ 'cf-connecting-ip': `capacity-${i}` })).limited, false);
  }
  const newcomer = fakeRequest({ 'cf-connecting-ip': 'capacity-new' });
  assert.equal(limits.checkRateLimit(newcomer).limited, true);
  const previous = fakeRequest({ 'cf-connecting-ip': 'capacity-0' });
  for (let i = 0; i < 4; i++) assert.equal(limits.checkRateLimit(previous).limited, false);
  assert.equal(limits.checkRateLimit(previous).limited, true);
  now += 600000;
  assert.equal(limits.checkRateLimit(newcomer).limited, false);
});
