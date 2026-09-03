// clientIp() choisit quelle IP faire confiance pour le plafonnement anti-spam
// (voir le commentaire dans rate-limit.js sur pourquoi cf-connecting-ip prime
// sur x-forwarded-for, falsifiable). checkRateLimit() est la seule barriere
// entre un abus et le quota Brevo (300 emails/jour) - zero couverture avant
// ce fichier.
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
