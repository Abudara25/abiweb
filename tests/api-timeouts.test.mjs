import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendBrevoEmail, upsertBrevoContact } from '../functions/api/_lib/email-utils.js';
import { onRequestPost as sendContact } from '../functions/api/send-contact.js';
import { onRequestPost as sendBrief } from '../functions/api/send-brief.js';

const env = { TURNSTILE_SECRET: 'test', TURNSTILE_HOSTNAMES: 'abiweb.fr', BREVO_API_KEY: 'test' };
const timeoutError = () => new DOMException('Timed out', 'TimeoutError');
const pendingFetch = (signal) => new Promise((_resolve, reject) => {
  signal.addEventListener('abort', () => reject(signal.reason), { once: true });
});

test('les appels email et CRM sont annulés par leur délai maximal', async (t) => {
  for (const [name, duration, run] of [
    ['email', 10000, () => sendBrevoEmail(env, { to: 'test@example.com', subject: 'Test', textContent: 'Test' })],
    ['CRM', 8000, () => upsertBrevoContact(env, { email: 'test@example.com', attributes: {} })],
  ]) {
    await t.test(name, async (t) => {
      const controller = new AbortController();
      t.mock.method(AbortSignal, 'timeout', (ms) => {
        assert.equal(ms, duration);
        return controller.signal;
      });
      t.mock.method(globalThis, 'fetch', (_url, { signal }) => pendingFetch(signal));
      const result = run();
      controller.abort(timeoutError());
      await assert.rejects(result, { name: 'TimeoutError' });
    });
  }
});

test('un timeout email retourne une erreur et laisse la nouvelle tentative possible', async (t) => {
  t.mock.method(console, 'error', () => {});
  const controllers = new Map();
  t.mock.method(AbortSignal, 'timeout', () => {
    const controller = new AbortController();
    controllers.set(controller.signal, controller);
    return controller.signal;
  });
  let firstEmailSignal;
  t.mock.method(globalThis, 'fetch', async (url, { signal }) => {
    if (String(url).includes('siteverify')) return Response.json({ success: true, action: 'contact', hostname: 'abiweb.fr' });
    if (String(url).endsWith('/smtp/email') && !firstEmailSignal) {
      firstEmailSignal = signal;
      return pendingFetch(signal);
    }
    return Response.json({ messageId: 'mocked' });
  });
  const body = { nom: 'Alice', email: 'alice@example.com', message: 'Projet', submissionId: 'timeout-retry-id', turnstileToken: 'valid-token' };
  const request = () => new Request('https://abiweb.fr/api/send-contact', { method: 'POST', headers: { 'cf-connecting-ip': 'timeout-client' }, body: JSON.stringify(body) });
  const tasks = [];
  const ctx = { waitUntil(task) { tasks.push(task); } };
  const result = sendContact({ request: request(), env, ctx });
  while (!firstEmailSignal) await new Promise((resolve) => setImmediate(resolve));
  controllers.get(firstEmailSignal).abort(timeoutError());
  assert.equal((await result).status, 500);
  assert.equal((await sendContact({ request: request(), env, ctx })).status, 200);
  await Promise.all(tasks);
});

test('un timeout Supabase est alerté en arrière-plan après le succès du brief', async (t) => {
  t.mock.method(console, 'error', () => {});
  const controllers = new Map();
  t.mock.method(AbortSignal, 'timeout', (duration) => {
    const controller = new AbortController();
    controllers.set(controller.signal, { controller, duration });
    return controller.signal;
  });
  let databaseSignal;
  let emailCount = 0;
  t.mock.method(globalThis, 'fetch', async (url, { signal }) => {
    if (String(url).includes('siteverify')) return Response.json({ success: true, action: 'brief', hostname: 'abiweb.fr' });
    if (String(url).includes('/rest/v1/briefs')) {
      databaseSignal = signal;
      return pendingFetch(signal);
    }
    if (String(url).endsWith('/smtp/email')) emailCount++;
    return Response.json({ messageId: 'mocked' });
  });
  const body = { nom: 'Association', contact: 'Alice', email: 'alice@example.com', activite: 'Sport', tarifMode: 'forfait', formule: 'essentiel', turnstileToken: 'valid-token' };
  const request = new Request('https://abiweb.fr/api/send-brief', { method: 'POST', headers: { 'cf-connecting-ip': 'database-timeout-client' }, body: JSON.stringify(body) });
  const tasks = [];
  const response = await sendBrief({ request, env: { ...env, SUPABASE_URL: 'https://database.example', SUPABASE_ANON_KEY: 'test' }, ctx: { waitUntil(task) { tasks.push(task); } } });
  assert.equal(response.status, 200);
  while (!databaseSignal) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(controllers.get(databaseSignal).duration, 8000);
  controllers.get(databaseSignal).controller.abort(timeoutError());
  await Promise.all(tasks);
  assert.equal(emailCount, 2);
});
