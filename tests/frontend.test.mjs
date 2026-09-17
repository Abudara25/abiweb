import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FORMULES, MAINTENANCE, PHOTO_OPTIONS } from '../js/pricing-catalogue.js';
import { createSubmissionState } from '../js/form-ui.js';

const home = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const brief = await readFile(new URL('../devis/index.html', import.meta.url), 'utf8');
const number = text => Number(text.replace(/\s/g, ''));

test('les cartes accueil et devis concordent avec les prix et délais du catalogue', () => {
  const homeCards = [...home.matchAll(/<div class="plan(?: featured)?">([\s\S]*?)data-formule="([^"]+)"/g)];
  assert.equal(homeCards.length, FORMULES.length);
  for (const [, card, key] of homeCards) {
    const pack = FORMULES.find(item => item.key === key);
    assert.ok(pack, key);
    assert.equal(card.match(/class="plan-name">([^<]+)/)[1], pack.name);
    assert.equal(number(card.match(/class="price-amount">([^<]+)/)[1]), pack.price);
    assert.equal(Number(card.match(/livraison (\d+) jours/)[1]), pack.delaiJours);
  }
  const briefCards = [...brief.matchAll(/name="formule" value="([^"]+)"[^>]*>([\s\S]*?)<\/label>/g)];
  assert.equal(briefCards.length, FORMULES.length);
  for (const [, key, card] of briefCards) {
    const pack = FORMULES.find(item => item.key === key);
    assert.ok(pack, key);
    assert.equal(card.match(/class="formule-name">([^<]+)/)[1], pack.name);
    assert.equal(number(card.match(/class="formule-price">([^€]+)€/)[1]), pack.price);
    assert.equal(Number(card.match(/livraison (\d+) jours/)[1]), pack.delaiJours);
  }
});

test('les offres JSON-LD et le sélecteur contact gardent les mêmes prix que le catalogue', () => {
  const service = [...home.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(match => JSON.parse(match[1])).find(schema => schema['@type'] === 'ProfessionalService');
  assert.equal(service.makesOffer.length, FORMULES.length);
  for (const pack of FORMULES) {
    const offer = service.makesOffer.find(item => item.name === `Formule ${pack.name}`);
    assert.equal(Number(offer.price), pack.price);
    assert.equal(offer.deliveryLeadTime.value, pack.delaiJours);
    assert.ok(home.includes(`<option value="${pack.key}">${pack.name} - ${pack.price}€</option>`));
  }
});

test('les volumes de photos et les tarifs de maintenance visibles concordent avec le catalogue', () => {
  for (const option of PHOTO_OPTIONS) {
    assert.ok(brief.includes(`<option value="${option.value}">${option.label}</option>`), option.value);
  }
  const options = brief.match(/<select id="maintenance-choix">([\s\S]*?)<\/select>/)[1];
  for (const item of MAINTENANCE) {
    const label = options.match(new RegExp(`<option value="${item.key}">([^<]+)`))?.[1];
    assert.ok(label, item.key);
    if (item.price) assert.ok(label.includes(`${item.price}€/mois`), item.key);
  }
});

test('les formulaires sont reliés à leurs scripts modules et à des commandes clavier natives', () => {
  for (const [html, script, formId, submitId] of [[home, 'home', 'tab-contact', 'contactSubmitBtn'], [brief, 'devis', 'briefForm', 'submitBriefBtn']]) {
    assert.match(html, new RegExp(`<script[^>]*type="module"[^>]*src="/js/${script}\\.js(?:\\?[^\"]*)?"`));
    assert.match(html, new RegExp(`<form[^>]*id="${formId}"`));
    assert.match(html, new RegExp(`<button[^>]*id="${submitId}"[^>]*type="submit"`));
    assert.equal((html.match(/<form\b/g) || []).length, (html.match(/<\/form>/g) || []).length);
  }
  assert.doesNotMatch(brief, /<div class="color-chip/);
  for (const match of brief.matchAll(/<button[^>]*class="color-chip[^>]*>/g)) {
    assert.match(match[0], /type="button"/);
    assert.match(match[0], /aria-label="[^"]+"/);
    assert.match(match[0], /aria-pressed="(?:true|false)"/);
  }
  assert.match(brief, /id="stepAnnouncement"[^>]*role="status"/);
});

test('une tentative rejouée garde son identifiant même après renouvellement du jeton anti-bot', () => {
  let id = 0;
  const state = createSubmissionState(() => `id-${++id}`);
  const first = state.prepare({ nom: 'Camille', message: 'Mon projet', turnstileToken: 'old', ts: 10 });
  const retry = state.prepare({ nom: 'Camille', message: 'Mon projet', turnstileToken: 'new', ts: 20 });
  assert.equal(retry.submissionId, first.submissionId);
  const edited = state.prepare({ nom: 'Camille', message: 'Autre projet', turnstileToken: 'new' });
  assert.notEqual(edited.submissionId, first.submissionId);
  state.reset();
  assert.notEqual(state.prepare({ nom: 'Camille', message: 'Autre projet', turnstileToken: 'new' }).submissionId, edited.submissionId);
});
