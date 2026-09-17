const GITHUB_USER = 'Abudara25';

const ETAPES = {
  paiement_recu: 'Paiement reçu',
  developpement: 'Développement en cours',
  preview: 'Prévisualisation du projet',
  corrections: 'Intégration de vos retours',
  mise_en_ligne: 'Site en ligne',
  garantie_retouches: 'Garantie retouches en cours',
};

const ETAPES_ORDER = [
  'paiement_recu',
  'developpement',
  'preview',
  'corrections',
  'mise_en_ligne',
  'garantie_retouches',
];

const ETAPES_COMPLETES = new Set(['mise_en_ligne', 'garantie_retouches']);

function getRepoParam() {
  const params = new URLSearchParams(window.location.search);
  const repo = params.get('repo');
  if (!repo) return null;
  // Un nom de repo GitHub valide : lettres, chiffres, points, tirets, underscores.
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(repo) || /^\.+$/.test(repo)) return null;
  return repo;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function renderError(card, title, detail) {
  card.innerHTML = '';
  card.setAttribute('aria-busy', 'false');
  const wrap = document.createElement('div');
  wrap.className = 'error';

  const icon = document.createElement('span');
  icon.className = 'error-icon';
  icon.textContent = '⚠️';
  icon.setAttribute('aria-hidden', 'true');

  const titleEl = document.createElement('p');
  titleEl.className = 'error-title';
  titleEl.textContent = title;

  const detailEl = document.createElement('p');
  detailEl.textContent = detail;

  wrap.append(icon, titleEl, detailEl);
  card.appendChild(wrap);
}

function isValidStatus(data) {
  return (
    data &&
    typeof data.client === 'string' && data.client.trim() &&
    typeof data.etape === 'string' &&
    Object.prototype.hasOwnProperty.call(ETAPES, data.etape) &&
    Number.isFinite(data.avancement) &&
    data.avancement >= 0 &&
    data.avancement <= 100 &&
    typeof data.message === 'string' && data.message.trim() &&
    typeof data.derniere_maj === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(data.derniere_maj) &&
    !Number.isNaN(Date.parse(data.derniere_maj)) &&
    new Date(data.derniere_maj).toISOString().slice(0, 10) === data.derniere_maj
  );
}

function buildStepper(currentEtape) {
  const complete = ETAPES_COMPLETES.has(currentEtape);
  const currentIndex = ETAPES_ORDER.indexOf(currentEtape);

  const stepper = document.createElement('ol');
  stepper.className = 'stepper';

  ETAPES_ORDER.forEach((etape, index) => {
    const li = document.createElement('li');
    let state = 'upcoming';
    if (index < currentIndex) state = 'done';
    else if (index === currentIndex) state = complete ? 'done' : 'current';
    li.className = 'step is-' + state;
    if (index === currentIndex) li.setAttribute('aria-current', 'step');

    const marker = document.createElement('span');
    marker.className = 'step-marker';
    marker.textContent = state === 'done' ? '✓' : '';
    marker.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'step-label';
    label.textContent = ETAPES[etape];

    const accessibleState = document.createElement('span');
    accessibleState.className = 'sr-only';
    accessibleState.textContent = index === currentIndex ? ' — Étape actuelle' :
      (state === 'done' ? ' — Terminée' : ' — À venir');

    li.append(marker, label, accessibleState);
    stepper.appendChild(li);
  });

  return stepper;
}

function renderStatus(card, data) {
  card.innerHTML = '';
  card.setAttribute('aria-busy', 'false');

  const complete = ETAPES_COMPLETES.has(data.etape);

  const clientEl = document.createElement('p');
  clientEl.className = 'client-name';
  clientEl.textContent = data.client;

  const etapeEl = document.createElement('p');
  etapeEl.className = 'etape-label';
  etapeEl.textContent = ETAPES[data.etape];

  const stepper = buildStepper(data.etape);

  const progressLabel = document.createElement('p');
  progressLabel.className = 'progress-label';
  progressLabel.textContent = 'Avancement : ' + data.avancement + ' %';
  const progress = document.createElement('progress');
  progress.className = 'progress';
  progress.max = 100;
  progress.value = data.avancement;
  progress.setAttribute('aria-label', 'Avancement du projet');

  const messageEl = document.createElement('div');
  messageEl.className = 'message-box' + (complete ? ' is-complete' : '');
  messageEl.textContent = data.message;

  const updatedEl = document.createElement('p');
  updatedEl.className = 'updated-at';
  updatedEl.textContent = 'Dernière mise à jour : ' + formatDate(data.derniere_maj);

  card.append(clientEl, etapeEl, progressLabel, progress, stepper, messageEl, updatedEl);
}

async function loadStatus(repo, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const base = `https://raw.githubusercontent.com/${GITHUB_USER}/${repo}`;
  try {
    const options = { cache: 'no-store', signal: controller.signal };
    let response = await fetch(`${base}/project-status/status.json`, options);
    // Les liens existants restent valables avant la migration du dépôt client.
    // Une panne ou un état invalide ne doit pas afficher des données anciennes.
    if (response.status === 404) response = await fetch(`${base}/main/status.json`, options);
    if (!response.ok) throw new Error(response.status === 404 ? 'not_found' : 'http_error');
    const data = await response.json();
    if (!isValidStatus(data)) throw new Error('invalid_status');
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function init() {
  const card = document.getElementById('card');
  const repo = getRepoParam();

  if (!repo) {
    renderError(
      card,
      'Lien de suivi incomplet',
      "Aucun projet n'est précisé dans le lien. Vérifiez que l'adresse se termine bien par ?repo=nom-du-projet, ou redemandez le lien à AbiWeb."
    );
    return;
  }

  try {
    renderStatus(card, await loadStatus(repo));
  } catch (e) {
    if (e.message === 'not_found') {
      renderError(card, 'Suivi introuvable', "Ce projet n'a pas encore de suivi disponible, ou le lien est incorrect. Contactez AbiWeb si le problème persiste.");
    } else if (e.name === 'AbortError') {
      renderError(card, 'Le suivi met trop de temps à répondre', 'Rechargez la page dans quelques instants ou contactez AbiWeb.');
    } else if (e.message === 'invalid_status' || e.name === 'SyntaxError') {
      renderError(card, 'Suivi momentanément indisponible', 'Les informations de suivi sont incomplètes ou illisibles. Merci de contacter AbiWeb.');
    } else {
      renderError(card, 'Suivi momentanément indisponible', 'Impossible de contacter le service de suivi. Vérifiez votre connexion et réessayez dans quelques instants.');
    }
  }
}

init();
