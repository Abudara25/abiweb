import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const STEPS = {
  paiement_recu: { progress: 5, message: 'Votre projet a démarré, le développement va commencer.' },
  developpement: { progress: 30, message: 'Votre site est en cours de développement.' },
  preview: { progress: 75, message: 'Votre projet est en phase de prévisualisation. AbiWeb vous transmet le lien après vérification de la démonstration.' },
  corrections: { progress: 85, message: 'Vos retours sont en cours d’intégration.' },
  mise_en_ligne: { progress: 100, message: 'Votre site est en ligne.' },
  garantie_retouches: { progress: 100, message: 'La période de retouches offertes est en cours (7 jours).' },
};

const ORDER = Object.keys(STEPS);

function validateStatus(status) {
  if (!status || !Object.hasOwn(STEPS, status.etape) ||
      typeof status.client !== 'string' || !status.client.trim() ||
      typeof status.message !== 'string' || !status.message.trim() ||
      !Number.isFinite(status.avancement) || status.avancement < 0 || status.avancement > 100 ||
      typeof status.derniere_maj !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(status.derniere_maj) ||
      Number.isNaN(Date.parse(status.derniere_maj)) ||
      new Date(status.derniere_maj).toISOString().slice(0, 10) !== status.derniere_maj) {
    throw new Error('status.json est invalide : corriger les données avant de publier.');
  }
}

export function transitionStatus(current, {
  eventName, ref, requestedStep, siteIsLive = false, message = '',
  date = new Date().toISOString().slice(0, 10),
}) {
  validateStatus(current);
  let target;
  if (eventName === 'push') {
    if (!ref?.startsWith('refs/heads/') || ref === 'refs/heads/main' || ref === 'refs/heads/project-status') return current;
    target = ref === 'refs/heads/preview' ? 'preview' : 'developpement';
  } else if (eventName === 'workflow_dispatch') {
    if (!Object.hasOwn(STEPS, requestedStep)) throw new Error('Étape demandée inconnue.');
    target = requestedStep;
    if (ORDER.indexOf(target) >= ORDER.indexOf('mise_en_ligne') && !siteIsLive) {
      throw new Error('Confirmer le déploiement réussi et l’accès au site avant de publier cette étape.');
    }
  } else {
    throw new Error('Événement non pris en charge.');
  }

  // Comparer les étapes aussi : mise_en_ligne et garantie_retouches sont à 100 %.
  const currentIndex = ORDER.indexOf(current.etape);
  const targetIndex = ORDER.indexOf(target);
  if (targetIndex < currentIndex) return current;
  const publicMessage = eventName === 'workflow_dispatch' ? message.trim() : '';
  if (targetIndex === currentIndex && (!publicMessage || publicMessage === current.message)) return current;

  const next = {
    ...current,
    etape: target,
    avancement: Math.max(current.avancement, STEPS[target].progress),
    derniere_maj: date,
    message: publicMessage || STEPS[target].message,
  };
  validateStatus(next);
  return next;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) throw new Error('Usage : node update-status.mjs entrée.json sortie.json');
  const current = JSON.parse(readFileSync(inputPath, 'utf8'));
  const next = transitionStatus(current, {
    eventName: process.env.STATUS_EVENT_NAME,
    ref: process.env.STATUS_EVENT_REF,
    requestedStep: process.env.STATUS_REQUESTED_STEP,
    siteIsLive: process.env.STATUS_SITE_IS_LIVE === 'true',
    message: process.env.STATUS_MESSAGE || '',
  });
  writeFileSync(outputPath, JSON.stringify(next, null, 2) + '\n');
}
