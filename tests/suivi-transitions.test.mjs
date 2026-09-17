import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transitionStatus } from '../client-template/update-status.mjs';

const initial = {
  client: 'Client public', etape: 'paiement_recu', avancement: 5,
  derniere_maj: '2026-09-01', message: 'Acompte reçu.',
};
const push = (branch) => ({ eventName: 'push', ref: `refs/heads/${branch}`, date: '2026-09-17' });
const manual = (requestedStep, extra = {}) => ({ eventName: 'workflow_dispatch', requestedStep, date: '2026-09-17', ...extra });

test('les branches de travail et preview avancent la même fiche client', () => {
  const development = transitionStatus(initial, push('feature/galerie'));
  assert.equal(development.etape, 'developpement');
  assert.equal(development.avancement, 30);
  const preview = transitionStatus(development, push('preview'));
  assert.equal(preview.etape, 'preview');
  assert.equal(preview.avancement, 75);
  assert.equal(preview.client, initial.client);
  assert.equal(preview.derniere_maj, '2026-09-17');
  assert.equal(initial.etape, 'paiement_recu');
});

test('main, la branche de données et les tags ne déclarent aucune livraison', () => {
  assert.strictEqual(transitionStatus(initial, push('main')), initial);
  assert.strictEqual(transitionStatus(initial, push('project-status')), initial);
  assert.strictEqual(transitionStatus(initial, { ...push('main'), ref: 'refs/tags/v1' }), initial);
});

test('un push tardif préserve corrections, pourcentage et date manuels', () => {
  const corrections = { ...initial, etape: 'corrections', avancement: 91, message: 'Dernier retour en cours.' };
  for (const branch of ['feature/footer', 'preview']) {
    assert.strictEqual(transitionStatus(corrections, push(branch)), corrections);
  }
  const development = { ...initial, etape: 'developpement', avancement: 60 };
  assert.strictEqual(transitionStatus(development, push('feature/footer')), development);
});

test('la mise en ligne et la garantie exigent une confirmation de déploiement', () => {
  for (const step of ['mise_en_ligne', 'garantie_retouches']) {
    assert.throws(() => transitionStatus(initial, manual(step)), /Confirmer le déploiement/);
    const confirmed = transitionStatus(initial, manual(step, { siteIsLive: true }));
    assert.equal(confirmed.etape, step);
    assert.equal(confirmed.avancement, 100);
  }
});

test('la garantie ne régresse pas vers la mise en ligne malgré les deux pourcentages à 100', () => {
  const guarantee = transitionStatus(initial, manual('garantie_retouches', { siteIsLive: true }));
  assert.strictEqual(transitionStatus(guarantee, manual('mise_en_ligne', { siteIsLive: true })), guarantee);
  assert.strictEqual(transitionStatus(guarantee, push('preview')), guarantee);
});

test('un message peut changer sur la même étape sans perdre un avancement personnalisé', () => {
  const current = { ...initial, etape: 'corrections', avancement: 92 };
  const updated = transitionStatus(current, manual('corrections', { message: '  Vos derniers retours sont intégrés.  ' }));
  assert.equal(updated.avancement, 92);
  assert.equal(updated.message, 'Vos derniers retours sont intégrés.');
  assert.equal(updated.derniere_maj, '2026-09-17');
  assert.strictEqual(transitionStatus(updated, manual('corrections', { message: updated.message })), updated);
});

test('les données sources invalides arrêtent la publication au lieu de réinitialiser le client', () => {
  for (const invalid of [null, { ...initial, client: '' }, { ...initial, avancement: 101 },
    { ...initial, avancement: NaN }, { ...initial, etape: '__proto__' },
    { ...initial, derniere_maj: '2026-02-30' }, { ...initial, derniere_maj: 'hier' }]) {
    assert.throws(() => transitionStatus(invalid, push('feature/test')), /status.json est invalide/);
  }
  assert.throws(() => transitionStatus(initial, manual('inconnu')), /Étape demandée inconnue/);
});
