import { test } from 'node:test';
import assert from 'node:assert/strict';

let moduleNumber = 0;
const load = () => import(`../functions/api/_lib/submissions.js?idempotency-test-${++moduleNumber}`);
const request = (ip = 'client-a') => new Request('https://abiweb.fr/api/send-contact', { headers: { 'cf-connecting-ip': ip } });
const ok = () => Response.json({ ok: true });

test('la clé idempotente est isolée par route, IP et contenu', async () => {
  const { withIdempotency } = await load();
  let calls = 0;
  const operation = () => { calls++; return ok(); };
  const data = { email: 'test@example.com', message: 'Projet' };
  await withIdempotency(request(), 'contact', 'submission-123', data, operation);
  await withIdempotency(request(), 'contact', 'submission-123', data, operation);
  assert.equal(calls, 1);
  const conflict = await withIdempotency(request(), 'contact', 'submission-123', { ...data, message: 'Autre' }, operation);
  assert.equal(conflict.status, 409);
  await withIdempotency(request('client-b'), 'contact', 'submission-123', data, operation);
  await withIdempotency(request(), 'brief', 'submission-123', data, operation);
  assert.equal(calls, 3);
});

test('la réponse en cache reste lisible pour chaque retry', async () => {
  const { withIdempotency } = await load();
  const first = await withIdempotency(request(), 'contact', 'submission-123', {}, ok);
  assert.deepEqual(await first.json(), { ok: true });
  const retry = await withIdempotency(request(), 'contact', 'submission-123', {}, () => assert.fail('opération répétée'));
  assert.deepEqual(await retry.json(), { ok: true });
});

test('un rejet ou une exception ne bloque pas une nouvelle tentative', async () => {
  const { withIdempotency } = await load();
  const run = (operation) => withIdempotency(request(), 'contact', 'submission-123', {}, operation);
  assert.equal((await run(() => Response.json({ error: 'temporary' }, { status: 503 }))).status, 503);
  await assert.rejects(run(() => { throw new Error('network failure'); }), /network failure/);
  assert.equal((await run(ok)).status, 200);
});

test('la protection expire dix minutes après le succès', async (t) => {
  const { withIdempotency } = await load();
  let now = 1000000;
  let calls = 0;
  t.mock.method(Date, 'now', () => now);
  const run = () => withIdempotency(request(), 'contact', 'submission-123', {}, () => { calls++; return ok(); });
  await run();
  now += 599999;
  await run();
  assert.equal(calls, 1);
  now++;
  await run();
  assert.equal(calls, 2);
});

test('un cache plein refuse une nouvelle clé sans évincer la protection existante', async (t) => {
  const { withIdempotency } = await load();
  let now = 1000000;
  t.mock.method(Date, 'now', () => now);
  for (let i = 0; i < 1000; i++) {
    assert.equal((await withIdempotency(request(), 'contact', `submission-${i}`, {}, ok)).status, 200);
  }
  const overflow = await withIdempotency(request(), 'contact', 'submission-overflow', {}, () => assert.fail('cache plein'));
  assert.equal(overflow.status, 503);
  assert.equal(overflow.headers.get('Retry-After'), '10');
  const original = await withIdempotency(request(), 'contact', 'submission-0', {}, () => assert.fail('clé évincée'));
  assert.equal(original.status, 200);
  now += 600000;
  assert.equal((await withIdempotency(request(), 'contact', 'submission-overflow', {}, ok)).status, 200);
});

test('une opération en cours reste protégée même si la fenêtre de cache passe', async (t) => {
  const { withIdempotency } = await load();
  let now = 1000000;
  let finish;
  let calls = 0;
  t.mock.method(Date, 'now', () => now);
  const first = withIdempotency(request(), 'contact', 'submission-123', {}, () => {
    calls++;
    return new Promise((resolve) => { finish = resolve; });
  });
  // Laisse le calcul asynchrone de l'empreinte démarrer l'opération.
  while (!finish) await new Promise((resolve) => setImmediate(resolve));
  now += 600001;
  const retry = withIdempotency(request(), 'contact', 'submission-123', {}, () => { calls++; return ok(); });
  finish(ok());
  assert.ok((await Promise.all([first, retry])).every((response) => response.status === 200));
  assert.equal(calls, 1);
});
