import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const analyticsCode = readFileSync(new URL('../js/analytics-loader.js', import.meta.url), 'utf8');
const bannerCode = readFileSync(new URL('../js/cookie-banner.js', import.meta.url), 'utf8');

function page({ consent = null, storageBlocked = false, deferred = false } = {}) {
  const stored = new Map(consent ? [['abiweb-consent', consent]] : []);
  const scripts = [];
  const clearedCookies = [];
  const events = {};
  let reloads = 0;
  let focusReturns = 0;
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, {
        classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name), contains: (name) => classes.has(name) },
        addEventListener: (name, callback) => { events[id + ':' + name] = callback; },
        focus() { context.document.activeElement = this; },
      });
    }
    return elements.get(id);
  }
  const context = {
    localStorage: {
      getItem(key) { if (storageBlocked) throw new Error('SecurityError'); return stored.get(key) || null; },
      setItem(key, value) { if (storageBlocked) throw new Error('SecurityError'); stored.set(key, value); },
    },
    document: {
      head: { appendChild: (script) => scripts.push(script) },
      body: { insertAdjacentHTML() {} },
      createElement: () => ({}),
      getElementById: element,
      querySelectorAll: () => [],
      activeElement: { focus() { focusReturns++; } },
      addEventListener(name, callback) { events[name] = callback; },
      get cookie() { return '_ga=visitor; _ga_S2QVJFM4L5=session; unrelated=keep'; },
      set cookie(value) { clearedCookies.push(value); },
    },
    location: { hostname: 'www.abiweb.fr', reload() { reloads++; } },
    addEventListener(name, callback) { events[name] = callback; },
  };
  context.window = context;
  vm.createContext(context);
  if (deferred) vm.runInContext(bannerCode, context);
  vm.runInContext(analyticsCode, context);
  if (deferred) events.DOMContentLoaded();
  else vm.runInContext(bannerCode, context);
  return { context, stored, scripts, events, element, clearedCookies, reloads: () => reloads, focusReturns: () => focusReturns };
}

test('aucun script de mesure avant accord, y compris avec loader differe', () => {
  for (const deferred of [false, true]) {
    const p = page({ deferred });
    assert.equal(p.scripts.length, 0);
    assert.equal(p.context['ga-disable-G-S2QVJFM4L5'], true);
    assert.equal(p.element('cookieBanner').classList.contains('visible'), true);
  }
});

test('accepter plusieurs fois ne duplique ni les scripts ni la configuration', () => {
  const p = page();
  p.events['cookieAccept:click']();
  p.context.abiwebCookieChoice();
  assert.equal(p.stored.get('abiweb-consent'), 'granted', 'rouvrir conserve le choix courant');
  p.events['cookieAccept:click']();
  assert.equal(p.scripts.length, 2);
  assert.equal(p.context.dataLayer.filter((entry) => entry[0] === 'config').length, 1);
  assert.equal(p.focusReturns(), 1);
});

test('retirer un accord arrete GA, retire ses cookies et recharge pour decharger GTM', () => {
  const p = page({ consent: 'granted' });
  p.context.abiwebCookieChoice();
  p.events['cookieRefuse:click']();
  assert.equal(p.stored.get('abiweb-consent'), 'denied');
  assert.equal(p.context['ga-disable-G-S2QVJFM4L5'], true);
  const lastConsent = p.context.dataLayer.filter((entry) => entry[0] === 'consent').at(-1);
  assert.equal(lastConsent[2].analytics_storage, 'denied');
  assert.ok(p.clearedCookies.some((cookie) => cookie.includes('Domain=abiweb.fr')));
  assert.ok(p.clearedCookies.every((cookie) => !cookie.includes('unrelated')));
  assert.equal(p.reloads(), 1);
  assert.equal(page({ consent: 'denied' }).scripts.length, 0);
});

test('le stockage indisponible ne casse pas le bandeau et le refus reste effectif', () => {
  const p = page({ storageBlocked: true });
  p.events['cookieAccept:click']();
  p.events['cookieRefuse:click']();
  assert.equal(p.context.abiwebConsent.get(), 'denied');
  assert.equal(p.context['ga-disable-G-S2QVJFM4L5'], true);
  assert.equal(p.reloads(), 0);
});

test('le retrait dans un autre onglet est applique a la page deja ouverte', () => {
  const p = page({ consent: 'granted' });
  p.events.storage({ key: 'abiweb-consent', newValue: 'denied' });
  assert.equal(p.context['ga-disable-G-S2QVJFM4L5'], true);
  assert.equal(p.reloads(), 1);
});
