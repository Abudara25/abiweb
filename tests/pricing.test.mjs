import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_PRICE, MODULES, FORMULES, alaCarteTotal, bestPackSuggestion,
  estimateMediaConstraints, photoCount,
} from '../js/pricing-catalogue.js';

test('le total compte chaque module une seule fois et ignore les clés inconnues', () => {
  assert.equal(alaCarteTotal([]), BASE_PRICE);
  assert.equal(alaCarteTotal(['admin', 'admin', 'inconnu']), BASE_PRICE + 300);
  assert.equal(alaCarteTotal(MODULES.map(module => module.key)), 1790);
});

test('Premium remplace la recommandation Standard plus chère pour une sélection partielle', () => {
  const selected = ['admin', 'galerie', 'inscription', 'blog', 'stripe', 'seo', 'geo'];
  assert.equal(alaCarteTotal(selected), 1550);
  const suggestion = bestPackSuggestion(selected);
  assert.equal(suggestion.formule.key, 'premium');
  assert.equal(suggestion.packTotal, 1290);
  assert.equal(suggestion.savings, 260);
  assert.deepEqual(suggestion.extraKeys, []);
  assert.deepEqual(suggestion.includedExtraKeys, ['helloasso', 'brevo', 'resa']);
});

test('les 1024 sélections proposent le prix le plus bas couvrant tous les besoins', () => {
  for (let bits = 0; bits < 2 ** MODULES.length; bits++) {
    const selected = MODULES.filter((_, index) => bits & (1 << index));
    const keys = selected.map(module => module.key);
    const total = alaCarteTotal(keys);
    const achievable = FORMULES.map(pack => pack.price + selected
      .filter(module => !pack.modules.includes(module.key))
      .reduce((sum, module) => sum + module.price, 0));
    const minimum = Math.min(total, ...achievable);
    const suggestion = bestPackSuggestion(keys);
    assert.equal(suggestion?.packTotal ?? total, minimum, keys.join(', '));
    if (suggestion) {
      assert.ok(keys.every(key => suggestion.formule.modules.includes(key) || suggestion.extraKeys.includes(key)));
      assert.equal(suggestion.savings, total - minimum);
      assert.ok(suggestion.savings > 0);
    }
  }
});

test('photos et vidéos hors forfait restent explicitement hors estimation', () => {
  const scope = (formule, photosNb, videos = 'non') => estimateMediaConstraints({ tarifMode: 'forfait', formule, photosNb, videos });
  assert.equal(scope('essentiel', '8').estimationStatus, 'standard');
  assert.equal(scope('essentiel', '15').estimationStatus, 'custom');
  assert.equal(scope('essentiel', '5', '1').estimationStatus, 'custom');
  assert.equal(scope('standard', '15', '2-3').estimationStatus, 'standard');
  assert.equal(scope('standard', '20').estimationStatus, 'custom');
  assert.equal(scope('premium', '20', '2-3').estimationStatus, 'standard');
  for (const pack of FORMULES) {
    const result = scope(pack.key, 'more');
    assert.equal(result.estimationStatus, 'custom');
    assert.match(result.estimationReasons.join(' '), /Plus de 20 photos/);
  }
});

test('la base à la carte ne chiffre pas implicitement les vidéos ni les grandes galeries', () => {
  const scope = (overrides = {}) => estimateMediaConstraints({ tarifMode: 'alacarte', moduleKeys: [], photosNb: '8', videos: 'non', ...overrides });
  assert.equal(scope().estimationStatus, 'standard');
  assert.equal(scope({ videos: '1' }).estimationStatus, 'custom');
  assert.equal(scope({ sections: ['Vidéos'] }).estimationStatus, 'custom');
  assert.equal(scope({ photosNb: 'more' }).estimationStatus, 'custom');
  assert.equal(scope({ moduleKeys: ['admin', 'galerie'], photosNb: '15', videos: '1' }).estimationStatus, 'standard');
  assert.equal(scope({ moduleKeys: ['galerie'], photosNb: '15' }).estimationStatus, 'custom');
});

test('les volumes de photos de l’ancien formulaire restent reconnus', () => {
  assert.equal(photoCount('Moins de 5'), 5);
  assert.equal(photoCount('Entre 5 et 10'), 10);
  assert.equal(photoCount('Entre 10 et 20'), 20);
  assert.equal(photoCount('Plus de 20 (Premium uniquement)'), Infinity);
});
