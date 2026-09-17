import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as sendContact } from '../functions/api/send-contact.js';
import { onRequestPost as sendBrief } from '../functions/api/send-brief.js';
import { onRequestPost as notifyPr } from '../functions/api/notify-pr.js';

const env = { TURNSTILE_SECRET: 'test-secret', TURNSTILE_HOSTNAMES: 'abiweb.fr', BREVO_API_KEY: 'test-key' };
let requestNumber = 0;
const contactData = (extra = {}) => ({ nom: 'Alice', email: 'alice@example.com', message: 'Un site pour mon activité', ...extra });
const briefData = (extra = {}) => ({ nom: 'Association', contact: 'Alice', email: 'alice@example.com', activite: 'Sport', tarifMode: 'forfait', formule: 'essentiel', ...extra });

function request(path, data, ip = `api-test-${++requestNumber}`) {
  return new Request(`https://abiweb.fr/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify({ turnstileToken: 'valid-mocked-token', ...data }),
  });
}

function context() {
  const tasks = [];
  return { tasks, waitUntil(task) { tasks.push(task); } };
}

function mockNetwork(t, action, custom) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url: String(url), init });
    if (custom) {
      const response = custom(String(url), init);
      if (response !== undefined) return response;
    }
    if (String(url).includes('siteverify')) return Response.json({ success: true, action, hostname: 'abiweb.fr' });
    return Response.json({ messageId: 'mocked' }, { status: 201 });
  });
  return calls;
}

const emails = (calls) => calls.filter((call) => call.url.endsWith('/smtp/email'));

test('contact et brief acceptent une horloge en avance ou aucun timestamp', async (t) => {
  for (const [handler, path, action, data] of [
    [sendContact, 'send-contact', 'contact', contactData({ ts: Date.now() + 600000 })],
    [sendBrief, 'send-brief', 'brief', briefData()],
  ]) {
    const calls = mockNetwork(t, action);
    const ctx = context();
    const response = await handler({ request: request(path, data), env, ctx });
    assert.equal(response.status, 200);
    assert.equal(emails(calls).length, 1);
    await Promise.all(ctx.tasks);
    t.mock.restoreAll();
  }
});

test('les champs trop longs sont rejetés au lieu de perdre du contenu', async (t) => {
  const calls = mockNetwork(t, 'contact');
  const response = await sendContact({ request: request('send-contact', contactData({ message: 'x'.repeat(5001) })), env });
  assert.equal(response.status, 400);
  assert.deepEqual((await response.json()).fields, ['message']);
  const brief = await sendBrief({ request: request('send-brief', briefData({ infos: 'x'.repeat(3001) })), env });
  assert.equal(brief.status, 400);
  assert.equal(calls.length, 0);
});

test('les échecs Turnstile ne consomment pas le quota global des envois', async (t) => {
  const calls = mockNetwork(t, 'contact');
  for (let i = 0; i < 65; i++) {
    const result = await sendContact({ request: request('send-contact', contactData({ turnstileToken: '' })), env });
    assert.equal(result.status, 403);
  }
  const result = await sendContact({ request: request('send-contact', contactData()), env });
  assert.equal(result.status, 200);
  assert.equal(emails(calls).length, 1);
});

test('le succès HTTP ne dépend pas de la fin de la synchronisation CRM', async (t) => {
  let finishCrm;
  const calls = mockNetwork(t, 'contact', (url) => url.endsWith('/contacts')
    ? new Promise((resolve) => { finishCrm = resolve; }) : undefined);
  const ctx = context();
  const result = await sendContact({ request: request('send-contact', contactData()), env, ctx });
  assert.equal(result.status, 200);
  assert.equal(ctx.tasks.length, 1);
  assert.equal(emails(calls).length, 1);
  assert.equal(typeof finishCrm, 'function');
  finishCrm(Response.json({ id: 1 }));
  await Promise.all(ctx.tasks);
  assert.ok(calls.every((call) => call.init.signal instanceof AbortSignal));
});

test('un retry concurrent ou après succès ne renvoie pas un deuxième email', async (t) => {
  const calls = mockNetwork(t, 'contact');
  const data = contactData({ submissionId: 'same-submission-001' });
  const ctx = context();
  const results = await Promise.all([1, 2].map(() => sendContact({ request: request('send-contact', data, 'same-visitor'), env, ctx })));
  assert.ok(results.every((response) => response.status === 200));
  const retry = await sendContact({ request: request('send-contact', { ...data, turnstileToken: '', ts: Date.now() }, 'same-visitor'), env, ctx });
  assert.equal(retry.status, 200);
  assert.equal(emails(calls).length, 1);
  await Promise.all(ctx.tasks);
  const conflict = await sendContact({ request: request('send-contact', { ...data, message: 'Autre contenu' }, 'same-visitor'), env, ctx });
  assert.equal(conflict.status, 409);
});

test('un email refusé peut être retenté avec le même identifiant', async (t) => {
  t.mock.method(console, 'error', () => {});
  let rejected = true;
  const calls = mockNetwork(t, 'contact', (url) => {
    if (url.endsWith('/smtp/email') && rejected) return Response.json({ error: 'temporary' }, { status: 503 });
  });
  const data = contactData({ submissionId: 'retry-after-error-001' });
  assert.equal((await sendContact({ request: request('send-contact', data, 'retry-visitor'), env })).status, 502);
  rejected = false;
  assert.equal((await sendContact({ request: request('send-contact', data, 'retry-visitor'), env })).status, 200);
  assert.equal(emails(calls).length, 2);
});

test('le tarif et les modules sont reconstruits depuis le catalogue', async (t) => {
  const calls = mockNetwork(t, 'brief');
  const result = await sendBrief({ request: request('send-brief', briefData({ tarifMode: 'alacarte', moduleKeys: ['admin', 'admin'], totalEstime: 1 })), env });
  assert.equal(result.status, 200);
  const payload = JSON.parse(emails(calls)[0].init.body);
  const data = JSON.parse(Buffer.from(payload.attachment[0].content, 'base64').toString('utf8'));
  assert.equal(data.totalEstime, 890);
  assert.deepEqual(data.moduleKeys, ['admin']);
  assert.equal(data.modulesChoisis.length, 1);
});

test('le serveur vérifie les formules, les modules et la maintenance', async (t) => {
  const calls = mockNetwork(t, 'brief');
  for (const extra of [{ formule: 'Premium - 1€' }, { maintenance: 'gratuite' }, { moduleKeys: ['inconnu'] }, { moduleKeys: new Array(21).fill('admin') }, { photosNb: '100000' }]) {
    assert.equal((await sendBrief({ request: request('send-brief', briefData(extra)), env })).status, 400);
  }
  assert.equal(calls.length, 0);
});

test('les anciens libellés sont compatibles et les besoins hors forfait sont signalés', async (t) => {
  const calls = mockNetwork(t, 'brief');
  const response = await sendBrief({ request: request('send-brief', briefData({ formule: 'Essentiel - 590€', maintenance: 'Basique - 25€/mois', photosNb: 'more', videos: '1', estimationStatus: 'standard' })), env });
  assert.equal(response.status, 200);
  const payload = JSON.parse(emails(calls)[0].init.body);
  const data = JSON.parse(Buffer.from(payload.attachment[0].content, 'base64').toString('utf8'));
  assert.equal(data.formuleKey, 'essentiel');
  assert.equal(data.totalEstime, 590);
  assert.equal(data.maintenanceKey, 'basique');
  assert.equal(data.estimationStatus, 'custom');
  assert.equal(data.estimationReasons.length, 2);
  assert.match(payload.textContent, /Hors estimation/);
});

test('une panne Supabase est alertée sans changer le succès du brief', async (t) => {
  t.mock.method(console, 'error', () => {});
  const calls = mockNetwork(t, 'brief', (url) => url.includes('/rest/v1/briefs')
    ? Response.json({ error: 'unavailable' }, { status: 503 }) : undefined);
  const ctx = context();
  const response = await sendBrief({ request: request('send-brief', briefData()), env: { ...env, SUPABASE_URL: 'https://database.example', SUPABASE_ANON_KEY: 'test' }, ctx });
  assert.equal(response.status, 200);
  await Promise.all(ctx.tasks);
  assert.equal(emails(calls).length, 2);
  assert.ok(calls.find((call) => call.url.includes('/rest/v1/briefs')).init.signal instanceof AbortSignal);
});

test('notify-pr exige le secret et refuse les champs tronqués', async (t) => {
  const calls = mockNetwork(t, 'contact');
  const data = { secret: 'notify-test', clientNom: 'Client', url: 'https://github.com/example/project/pull/1' };
  assert.equal((await notifyPr({ request: request('notify-pr', data), env })).status, 401);
  const notifyEnv = { ...env, NOTIFY_SECRET: 'notify-test' };
  assert.equal((await notifyPr({ request: request('notify-pr', { ...data, clientNom: 'x'.repeat(201) }), env: notifyEnv })).status, 400);
  assert.equal((await notifyPr({ request: request('notify-pr', data), env: notifyEnv })).status, 200);
  assert.equal(emails(calls).length, 1);
  assert.ok(emails(calls)[0].init.signal instanceof AbortSignal);
});
