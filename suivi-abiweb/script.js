const GITHUB_USER = 'Abudara25';

const ETAPES = {
  paiement_recu: 'Paiement reçu',
  developpement: 'Développement en cours',
  preview: 'Version de démonstration disponible',
  corrections: 'Intégration de vos retours',
  mise_en_ligne: 'Site en ligne',
  garantie_retouches: 'Garantie retouches en cours',
};

const ETAPES_COMPLETES = new Set(['mise_en_ligne', 'garantie_retouches']);

function getRepoParam() {
  const params = new URLSearchParams(window.location.search);
  const repo = params.get('repo');
  if (!repo) return null;
  // Un nom de repo GitHub valide : lettres, chiffres, points, tirets, underscores.
  if (!/^[A-Za-z0-9._-]+$/.test(repo)) return null;
  return repo;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function renderError(card, title, detail) {
  card.innerHTML = '';
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
    typeof data.client === 'string' &&
    typeof data.etape === 'string' &&
    Object.prototype.hasOwnProperty.call(ETAPES, data.etape) &&
    typeof data.avancement === 'number' &&
    data.avancement >= 0 &&
    data.avancement <= 100 &&
    typeof data.message === 'string' &&
    typeof data.derniere_maj === 'string'
  );
}

function renderStatus(card, data) {
  card.innerHTML = '';

  const complete = ETAPES_COMPLETES.has(data.etape);
  const avancement = Math.max(0, Math.min(100, data.avancement));

  const clientEl = document.createElement('p');
  clientEl.className = 'client-name';
  clientEl.textContent = data.client;

  const etapeEl = document.createElement('p');
  etapeEl.className = 'etape-label';
  etapeEl.textContent = ETAPES[data.etape];

  const track = document.createElement('div');
  track.className = 'progress-track';
  const fill = document.createElement('div');
  fill.className = 'progress-fill' + (complete ? ' is-complete' : '');
  fill.style.width = avancement + '%';
  track.appendChild(fill);

  const percentEl = document.createElement('p');
  percentEl.className = 'progress-percent';
  percentEl.textContent = avancement + '%';

  const messageEl = document.createElement('div');
  messageEl.className = 'message-box' + (complete ? ' is-complete' : '');
  messageEl.textContent = data.message;

  const updatedEl = document.createElement('p');
  updatedEl.className = 'updated-at';
  updatedEl.textContent = 'Dernière mise à jour : ' + formatDate(data.derniere_maj);

  card.append(clientEl, etapeEl, track, percentEl, messageEl, updatedEl);
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

  const url = `https://raw.githubusercontent.com/${GITHUB_USER}/${repo}/main/status.json`;

  let response;
  try {
    response = await fetch(url, { cache: 'no-store' });
  } catch (e) {
    renderError(
      card,
      'Suivi momentanément indisponible',
      'Impossible de contacter le service de suivi. Vérifiez votre connexion et réessayez dans quelques instants.'
    );
    return;
  }

  if (!response.ok) {
    renderError(
      card,
      'Suivi introuvable',
      "Ce projet n'a pas encore de suivi disponible, ou le lien est incorrect. Contactez AbiWeb si le problème persiste."
    );
    return;
  }

  let data;
  try {
    data = await response.json();
  } catch (e) {
    renderError(
      card,
      'Suivi momentanément indisponible',
      "Les informations de suivi n'ont pas pu être lues. Merci de contacter AbiWeb."
    );
    return;
  }

  if (!isValidStatus(data)) {
    renderError(
      card,
      'Suivi momentanément indisponible',
      "Les informations de suivi sont incomplètes. Merci de contacter AbiWeb."
    );
    return;
  }

  renderStatus(card, data);
}

init();
