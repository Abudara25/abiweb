import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const source = readFileSync(new URL('../suivi-abiweb/script.js', import.meta.url), 'utf8');
const status = { client: 'Client public', etape: 'corrections', avancement: 85, message: 'Retours en cours.', derniere_maj: '2026-09-17' };

class Element {
  constructor(tagName) { this.tagName = tagName; this.children = []; this.attributes = {}; this.text = ''; }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return this.text + this.children.map((child) => child.textContent).join(''); }
  set innerHTML(value) { assert.equal(value, '', 'les données publiques ne doivent jamais être interprétées comme du HTML'); this.text = ''; this.children = []; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); return child; }
}

function page(fetchImpl = () => { throw new Error('appel réseau inattendu'); }) {
  const card = new Element('main');
  const context = createContext({
    window: { location: { search: '' } },
    document: { getElementById: () => card, createElement: (tag) => new Element(tag) },
    fetch: fetchImpl, URLSearchParams, AbortController, setTimeout, clearTimeout, Date,
  });
  runInContext(source, context);
  return { context, card };
}

test('le suivi lit la branche centrale et expose pourcentage et état accessible', async () => {
  const calls = [];
  const { context, card } = page(async (url) => { calls.push(url); return Response.json(status); });
  context.window.location.search = '?repo=client-test';
  await context.init();
  assert.deepEqual(calls, ['https://raw.githubusercontent.com/Abudara25/client-test/project-status/status.json']);
  assert.equal(card.attributes['aria-busy'], 'false');
  const progress = card.children.find((node) => node.tagName === 'progress');
  assert.equal(progress.value, 85);
  assert.equal(progress.max, 100);
  assert.equal(progress.attributes['aria-label'], 'Avancement du projet');
  const steps = card.children.find((node) => node.tagName === 'ol').children;
  assert.equal(steps.filter((node) => node.attributes['aria-current'] === 'step').length, 1);
  assert.match(steps[3].textContent, /Étape actuelle/);
  assert.match(steps[2].textContent, /Terminée/);
  assert.match(steps[4].textContent, /À venir/);
  assert.match(card.textContent, /Avancement : 85 %/);
});

test('un dépôt non migré se replie sur main uniquement après un 404', async () => {
  const calls = [];
  const { context } = page(async (url) => {
    calls.push(url);
    return calls.length === 1 ? new Response('', { status: 404 }) : Response.json(status);
  });
  assert.deepEqual(await context.loadStatus('ancien-client'), status);
  assert.equal(calls.length, 2);
  assert.match(calls[1], /\/main\/status.json$/);
});

test('une panne ou un état central corrompu ne présente pas un état ancien de main', async () => {
  for (const response of [new Response('', { status: 503 }), new Response('{'), Response.json({ ...status, derniere_maj: '2026-02-30' })]) {
    let requests = 0;
    const { context } = page(async () => { requests++; return response; });
    await assert.rejects(context.loadStatus('client-test'));
    assert.equal(requests, 1);
  }
});

test('un suivi inexistant finit sur une erreur lisible', async () => {
  const { context, card } = page(async () => new Response('', { status: 404 }));
  context.window.location.search = '?repo=inexistant';
  await context.init();
  assert.match(card.textContent, /Suivi introuvable/);
  assert.equal(card.attributes['aria-busy'], 'false');
});

test('le délai maximal interrompt aussi bien la requête que la lecture du corps JSON', async () => {
  for (const delayBody of [false, true]) {
    let aborted = false;
    const { context } = page(async (_url, { signal }) => {
      const waitForAbort = () => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Timeout', 'AbortError')); }, { once: true });
      });
      return delayBody ? { ok: true, status: 200, json: waitForAbort } : waitForAbort();
    });
    await assert.rejects(context.loadStatus('client-test', 10), { name: 'AbortError' });
    assert.equal(aborted, true);
  }
});

test('les noms de dépôt invalides et les dates inexistantes sont rejetés', () => {
  const { context } = page();
  for (const repo of ['..', '.', 'client/secret', 'client avec espace', 'x'.repeat(101)]) {
    context.window.location.search = '?repo=' + encodeURIComponent(repo);
    assert.equal(context.getRepoParam(), null);
  }
  context.window.location.search = '?repo=Client-test_01';
  assert.equal(context.getRepoParam(), 'Client-test_01');
  assert.equal(Boolean(context.isValidStatus({ ...status, derniere_maj: '2026-02-30' })), false);
});

test('les données publiques restent du texte et le jour reste stable hors du fuseau français', () => {
  const { context, card } = page();
  const markup = '<img src=x onerror=alert(1)>';
  context.renderStatus(card, { ...status, client: markup, message: markup });
  assert.equal(card.children[0].textContent, markup);
  assert.equal(card.children[0].children.length, 0);
  const previousTimezone = process.env.TZ;
  try {
    process.env.TZ = 'America/Los_Angeles';
    assert.equal(context.formatDate('2026-07-31'), '31 juillet 2026');
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});
