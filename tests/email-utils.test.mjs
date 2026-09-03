// Ces fonctions sont la seule barriere entre ce qu'un visiteur tape dans un
// formulaire et le HTML des emails envoyes par l'admin (contact@abiweb.fr) -
// un echappement casse ici ouvre une injection HTML/email. Zero couverture
// avant ce fichier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMAIL_RE,
  clean,
  cleanList,
  normalizeFrenchPhone,
  esc,
  escMultiline,
  toBase64,
} from '../functions/api/_lib/email-utils.js';

test('EMAIL_RE accepte des adresses valides', () => {
  assert.ok(EMAIL_RE.test('contact@abiweb.fr'));
  assert.ok(EMAIL_RE.test('a.b+tag@sous.domaine.co'));
});

test('EMAIL_RE rejette les adresses malformees', () => {
  assert.equal(EMAIL_RE.test('pas-un-email'), false);
  assert.equal(EMAIL_RE.test('a@b'), false); // pas de TLD
  assert.equal(EMAIL_RE.test('@abiweb.fr'), false);
  assert.equal(EMAIL_RE.test('a b@abiweb.fr'), false); // espace
});

test('clean trim et tronque, refuse le non-string', () => {
  assert.equal(clean('  bonjour  ', 20), 'bonjour');
  assert.equal(clean('a'.repeat(10), 5), 'aaaaa');
  assert.equal(clean(null, 10), '');
  assert.equal(clean(undefined, 10), '');
  assert.equal(clean(42, 10), '');
});

test('cleanList filtre, plafonne le nombre d\'elements et leur longueur', () => {
  assert.deepEqual(cleanList(['a', 'b', 'c'], 2, 10), ['a', 'b']);
  assert.deepEqual(cleanList(['  x  ', 42, null, 'y'], 10, 10), ['x', 'y']);
  assert.deepEqual(cleanList('pas-un-tableau', 10, 10), []);
  assert.deepEqual(cleanList(['abcdefghij'], 10, 3), ['abc']);
});

test('normalizeFrenchPhone convertit un 0X francais en 33X', () => {
  assert.equal(normalizeFrenchPhone('06 12 34 56 78'), '33612345678');
  assert.equal(normalizeFrenchPhone('01-23-45-67-89'), '33123456789');
});

test('normalizeFrenchPhone laisse passer un numero deja international', () => {
  assert.equal(normalizeFrenchPhone('+33612345678'), '33612345678');
});

test('normalizeFrenchPhone renvoie une chaine vide sans entree', () => {
  assert.equal(normalizeFrenchPhone(''), '');
  assert.equal(normalizeFrenchPhone(null), '');
});

test('esc echappe les 4 caracteres dangereux en HTML', () => {
  assert.equal(esc('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  assert.equal(esc('Tom & Jerry'), 'Tom &amp; Jerry');
});

test('esc convertit une valeur non-string (defense en profondeur)', () => {
  assert.equal(esc(42), '42');
});

test('escMultiline echappe puis convertit les retours ligne en <br />', () => {
  assert.equal(escMultiline('ligne1\nligne2<b>x</b>'), 'ligne1<br />ligne2&lt;b&gt;x&lt;/b&gt;');
});

test('toBase64 encode l\'UTF-8 correctement (accents, emoji)', () => {
  // Verite terrain via Buffer (dispo sous Node, pas sous Workers - c'est
  // justement pourquoi toBase64 existe, mais le resultat doit etre identique).
  const input = 'Café à Paris 🚀';
  assert.equal(toBase64(input), Buffer.from(input, 'utf8').toString('base64'));
});
