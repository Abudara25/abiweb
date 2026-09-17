import { readFileSync, writeFileSync } from 'node:fs';
import { BASE_LABEL, FORMULES, MODULES, MAINTENANCE, moduleLabels } from '../js/pricing-catalogue.js';

// Ces blocs restent disponibles aux robots et sans JavaScript. La CI refuse
// une modification du catalogue dont les versions statiques ne sont pas regenerees.
const check = process.argv.includes('--check');
const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const packContent = (pack) => pack.modules.length === MODULES.length
  ? `Base + les ${MODULES.length} modules à la carte`
  : pack.modules.length ? `Base + ${moduleLabels(pack.modules).join(' + ')}` : BASE_LABEL;
const mediaContent = (pack) => `Jusqu’à ${pack.maxPhotos} photos. ${pack.videos ? 'Intégration de liens vidéo incluse.' : 'Intégration vidéo sur devis complémentaire.'}`;

const llms = [
  '## Formules', '',
  ...FORMULES.map((pack) => `- **${pack.name} : ${pack.price} EUR**, livré en ${pack.delaiJours} jours ouvrés. ${packContent(pack)}. ${mediaContent(pack)}`),
  '', 'Les délais courent après réception des contenus et de l’acompte. Au-delà des limites incluses, notamment plus de 20 photos, un devis personnalisé est nécessaire.',
  'Acompte de 30 % à la commande, solde à la livraison.', '',
  '## Modules à la carte', '',
  ...MODULES.map((module) => `- ${module.label} : ${module.price} EUR`),
  '', 'La modification autonome des textes et photos nécessite le module admin, inclus dans Standard et Premium.', '',
  '## Maintenance mensuelle, optionnelle', '',
  ...MAINTENANCE.filter((option) => option.price).map((option) => `- ${option.label} : ${option.price} EUR/mois.`),
  '', 'Aucune maintenance n’est obligatoire. Un site livré sans maintenance reste la propriété du client et continue de fonctionner.',
].join('\n');

const cgv = [
  '    <table class="tarif-table">',
  '      <tr><th>Formule</th><th>Contenu</th><th>Tarif</th></tr>',
  ...FORMULES.map((pack) => `      <tr><td>${escapeHtml(pack.name)}</td><td>${escapeHtml(packContent(pack))}. ${escapeHtml(mediaContent(pack))} Délai : ${pack.delaiJours} jours ouvrés.</td><td>${pack.price.toLocaleString('fr-FR').replaceAll('\u202f', ' ')} €</td></tr>`),
  '    </table>',
  '    <p>Modules à la carte : ' + MODULES.map((module) => `${escapeHtml(module.label)} : ${module.price} €`).join(' ; ') + '.</p>',
  '    <p>L’outil tiers utilisé pour chaque module est choisi avec le client selon ses besoins. La modification autonome nécessite le module admin, inclus dans Standard et Premium. Les demandes dépassant les limites incluses, notamment plus de 20 photos, nécessitent un devis complémentaire.</p>',
  '    <p>Maintenance mensuelle optionnelle : ' + MAINTENANCE.filter((option) => option.price).map((option) => `${escapeHtml(option.label)} : ${option.price} €/mois`).join(' ; ') + '.</p>',
].join('\n');

let stale = false;
for (const [file, block] of [['llms.txt', llms], ['cgv/index.html', cgv]]) {
  const url = new URL('../' + file, import.meta.url);
  const source = readFileSync(url, 'utf8').replaceAll('\r\n', '\n');
  const marker = /<!-- catalogue:start -->[\s\S]*?<!-- catalogue:end -->/;
  if (!marker.test(source)) throw new Error(`Marqueurs catalogue absents : ${file}`);
  const updated = source.replace(marker, `<!-- catalogue:start -->\n${block}\n<!-- catalogue:end -->`);
  if (source === updated) continue;
  if (check) { console.error(`${file} : catalogue obsolète, exécuter npm run sync:catalogue`); stale = true; }
  else { writeFileSync(url, updated); console.log(`Catalogue synchronisé : ${file}`); }
}
if (stale) process.exitCode = 1;
