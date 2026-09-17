import * as pricing from './pricing-catalogue.js';
import { BRIEF_LIMITS } from './form-rules.js';
import { applyFieldLimits, setFieldError, createSubmissionState, postForm, formErrorMessage } from './form-ui.js';

let currentStep = 1;
let selectedColor1 = '#3b5bdb';
let selectedColor2 = '#ffffff';
const formLoadedAt = Date.now();
const briefSubmission = createSubmissionState();
let briefSending = false;

const fieldIds = {
  nom: 'nom-structure', contact: 'contact-nom', email: 'contact-email', tel: 'contact-tel',
  ville: 'contact-ville', activite: 'activite-desc', siteUrl: 'site-url', domaineNom: 'domaine-nom',
  fbLink: 'link-fb', igLink: 'link-ig', ytLink: 'link-yt', autreLink: 'link-autre',
  couleursTexte: 'couleurs-texte', refs: 'refs-sites', refNon: 'refs-non', infos: 'infos-plus',
};
applyFieldLimits(fieldIds, BRIEF_LIMITS);

// Echappe le texte saisi par le visiteur avant de l'injecter dans le récap (innerHTML).
function escHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ===== TARIFICATION =====
document.getElementById('brief-base-desc').textContent = '- ' + pricing.BASE_LABEL;
document.getElementById('brief-base-price').textContent = pricing.BASE_PRICE + ' €';

const briefModulesList = document.getElementById('brief-modules-list');
pricing.MODULES.forEach(mod => {
  const item = document.createElement('label');
  item.className = 'sim-module-item';
  item.innerHTML =
    `<span class="sim-module-check"><input type="checkbox" name="modules" value="${mod.key}" />` +
    `<span class="sim-module-text"><span class="sim-module-label">${mod.label}</span>` +
    `<span class="sim-module-desc">${mod.desc}</span></span></span>` +
    `<span class="sim-module-price">+${mod.price} €</span>`;
  briefModulesList.appendChild(item);
});

function updateAlaCarteTotal() {
  const checked = Array.from(briefModulesList.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value);
  briefModulesList.querySelectorAll('input[type="checkbox"]').forEach(c => {
    c.closest('.sim-module-item').classList.toggle('checked', c.checked);
  });
  const total = pricing.alaCarteTotal(checked);
  document.getElementById('brief-alacarte-total').textContent = total + ' €';

  const suggestionEl = document.getElementById('brief-suggestion');
  const suggestion = pricing.bestPackSuggestion(checked);
  if (suggestion) {
    suggestionEl.classList.add('visible');
    const extra = suggestion.extraKeys.length ? ' + options sélectionnées' : '';
    const included = suggestion.includedExtraKeys.length ? ' Ce pack inclut aussi des fonctions supplémentaires.' : '';
    suggestionEl.innerHTML = `La formule <strong>${suggestion.formule.name}${extra}</strong> couvre vos besoins pour <strong>${suggestion.packTotal} €</strong>, soit ${suggestion.savings} € d’économie.${included}`;
  } else {
    suggestionEl.classList.remove('visible');
    suggestionEl.innerHTML = '';
  }
  updateScopeWarning();
}
briefModulesList.addEventListener('change', updateAlaCarteTotal);
updateAlaCarteTotal();

function setTarifMode(mode) {
  document.getElementById('tarif-panel-forfait').style.display = mode === 'forfait' ? 'block' : 'none';
  document.getElementById('tarif-panel-alacarte').style.display = mode === 'alacarte' ? 'block' : 'none';
  updateScopeWarning();
}

function mediaConstraints() {
  return pricing.estimateMediaConstraints({
    tarifMode: document.querySelector('input[name="tarif-mode"]:checked')?.value,
    formule: document.querySelector('input[name="formule"]:checked')?.value,
    moduleKeys: Array.from(briefModulesList.querySelectorAll('input:checked')).map(input => input.value),
    photosNb: document.getElementById('photos-nb').value,
    videos: document.querySelector('input[name="videos"]:checked')?.value,
    sections: Array.from(document.querySelectorAll('input[name="sections"]:checked')).map(input => input.value),
  });
}

function updateScopeWarning() {
  const scope = mediaConstraints();
  const warning = document.getElementById('scopeWarning');
  warning.hidden = scope.estimationStatus !== 'custom';
  warning.textContent = scope.estimationStatus === 'custom'
    ? `Devis personnalisé nécessaire. Le montant affiché couvre la sélection tarifaire ; ces besoins restent à chiffrer : ${scope.estimationReasons.join(' ')}`
    : '';
}
document.querySelectorAll('input[name="tarif-mode"]').forEach(r => {
  r.addEventListener('change', () => { if (r.checked) setTarifMode(r.value); });
});

// ===== SUGGESTION AUTOMATIQUE DE FORMULE =====
// Déduite des besoins cochés à l'étape Contenu (sections, photos, vidéos). Reste un point de
// départ : dès que le client touche lui-même la tarification, on ne l'écrase plus jamais.
const TIER_ORDER = ['essentiel', 'standard', 'premium'];
let userModifiedTarif = false;

// Le formule qui "couvre" un module = la plus petite formule dont la liste de modules le contient.
function tierIndexForModule(key) {
  for (let i = 0; i < TIER_ORDER.length; i++) {
    if (pricing.formuleByKey(TIER_ORDER[i]).modules.indexOf(key) !== -1) return i;
  }
  return TIER_ORDER.length - 1;
}

function collectInferredModuleKeys() {
  const keys = [];
  document.querySelectorAll('input[name="sections"]:checked').forEach(c => {
    if (c.dataset.modules) keys.push(...c.dataset.modules.split(','));
  });
  return keys.filter((k, i) => keys.indexOf(k) === i);
}

const REASON_LABELS = {
  galerie: 'une galerie photos',
  blog: 'une rubrique actualités',
  inscription: 'un formulaire d’adhésion avec confirmation PDF',
  helloasso: 'un paiement en ligne pour les adhésions',
};

function markTarifTouched() {
  if (userModifiedTarif) return;
  userModifiedTarif = true;
  const box = document.getElementById('tarifSuggestionBox');
  box.classList.add('tarif-suggestion-touched');
  box.innerHTML = `
    <div class="tarif-suggestion-inner">
      <span class="tarif-suggestion-icon">✏️</span>
      <div><strong>Sélection personnalisée</strong>
      <span class="tarif-suggestion-reason">Vous avez ajusté la tarification vous-même, on garde votre choix.</span></div>
    </div>`;
}
document.querySelectorAll('input[name="formule"]').forEach(r => r.addEventListener('change', markTarifTouched));
document.querySelectorAll('input[name="tarif-mode"]').forEach(r => r.addEventListener('change', markTarifTouched));
briefModulesList.addEventListener('change', markTarifTouched);

function updateTarifSuggestion() {
  const box = document.getElementById('tarifSuggestionBox');
  if (!box || userModifiedTarif) return;

  const inferredKeys = collectInferredModuleKeys();
  const videos = document.querySelector('input[name="videos"]:checked')?.value;
  const photosNb = document.getElementById('photos-nb').value;

  let idx = 0;
  const reasons = [];
  inferredKeys.forEach(k => {
    idx = Math.max(idx, tierIndexForModule(k));
    if (REASON_LABELS[k] && !reasons.includes(REASON_LABELS[k])) reasons.push(REASON_LABELS[k]);
  });
  const wantsVideos = videos && videos !== 'non' || document.querySelector('input[name="sections"][value="Vidéos"]').checked;
  if (wantsVideos) { idx = Math.max(idx, 1); reasons.push('l’intégration de vidéos'); }
  const photosCount = pricing.photoCount(photosNb);
  if (photosCount > 8) { idx = Math.max(idx, photosCount > 15 ? 2 : 1); reasons.push('le nombre de photos'); }

  const formule = pricing.formuleByKey(TIER_ORDER[idx]);
  const reasonText = reasons.length
    ? `D’après votre projet (${reasons.join(', ')}).`
    : 'D’après votre projet, aucun besoin spécifique n’a encore été signalé.';

  box.innerHTML = `
    <div class="tarif-suggestion-inner">
      <span class="tarif-suggestion-icon">💡</span>
      <div><strong>Suggestion pour vous : formule ${formule.name} (${formule.price} €)</strong>
      <span class="tarif-suggestion-reason">${reasonText} C’est un point de départ : cochez ou décochez librement chaque fonction ci-dessous.</span></div>
    </div>`;

  // Pré-coche uniquement les fonctions réellement demandées, jamais tout le pack par défaut
  // (objectif : éviter qu'un client se retrouve avec des fonctions Premium inutiles).
  briefModulesList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = inferredKeys.includes(cb.value);
  });
  updateAlaCarteTotal();

  // Présélectionne + badge la formule correspondante, pour le client qui préfère un forfait fixe
  document.querySelectorAll('.formule-suggested-badge').forEach(b => b.remove());
  const radio = document.querySelector(`input[name="formule"][value="${formule.key}"]`);
  if (radio) {
    radio.checked = true;
    const card = radio.nextElementSibling;
    if (card) {
      const badge = document.createElement('div');
      badge.className = 'formule-badge formule-suggested-badge';
      badge.textContent = 'Suggéré pour vous';
      card.insertBefore(badge, card.firstChild);
    }
  }
  updateScopeWarning();
}

// Prefill from the homepage simulator, if the visitor came from "Demander un devis"
(function prefillFromSimulator() {
  let raw;
  try { raw = sessionStorage.getItem('abiweb_pricing_selection'); } catch { return; }
  if (!raw) return;
  try {
    const selection = JSON.parse(raw);
    if (selection.formule) {
      // Arrivée depuis un bouton "Choisir X" de l'accueil : ce choix explicite prime sur la suggestion auto
      const f = pricing.formuleByKey(selection.formule);
      const radio = f && document.querySelector(`input[name="formule"][value="${f.key}"]`);
      if (radio) {
        radio.checked = true;
        document.querySelector('input[name="tarif-mode"][value="forfait"]').checked = true;
        setTarifMode('forfait');
        userModifiedTarif = true;
      }
    } else if (Array.isArray(selection.modules)) {
      document.querySelector('input[name="tarif-mode"][value="alacarte"]').checked = true;
      setTarifMode('alacarte');
      pricing.uniqueModuleKeys(selection.modules).forEach(key => {
        const cb = briefModulesList.querySelector(`input[value="${key}"]`);
        if (cb) cb.checked = true;
      });
      updateAlaCarteTotal();
      userModifiedTarif = true;
    }
  } catch {}
  try { sessionStorage.removeItem('abiweb_pricing_selection'); } catch { /* Stockage facultatif. */ }
})();

// Show/hide site URL
document.querySelectorAll('input[name="site-existant"]').forEach(r => {
  r.addEventListener('change', () => {
    document.getElementById('site-url-wrap').style.display =
      r.value === 'oui' && r.checked ? 'block' : 'none';
  });
});

// Color chips
document.querySelectorAll('.color-chip').forEach(chip => {
  chip.addEventListener('click', function() {
    const group = this.dataset.group;
    document.querySelectorAll(`.color-chip[data-group="${group}"]`).forEach(c => {
      c.classList.remove('selected');
      c.setAttribute('aria-pressed', 'false');
    });
    this.classList.add('selected');
    this.setAttribute('aria-pressed', 'true');
    if (group === '1') { selectedColor1 = this.dataset.color; document.getElementById('colorPicker1').value = this.dataset.color; }
    else { selectedColor2 = this.dataset.color; document.getElementById('colorPicker2').value = this.dataset.color; }
  });
});
document.getElementById('colorPicker1').addEventListener('input', function() {
  document.querySelectorAll('.color-chip[data-group="1"]').forEach(c => { c.classList.remove('selected'); c.setAttribute('aria-pressed', 'false'); });
  selectedColor1 = this.value;
});
document.getElementById('colorPicker2').addEventListener('input', function() {
  document.querySelectorAll('.color-chip[data-group="2"]').forEach(c => { c.classList.remove('selected'); c.setAttribute('aria-pressed', 'false'); });
  selectedColor2 = this.value;
});

function validate(step) {
  let ok = true;
  if (step === 1) {
    const fields = [
      { id: 'nom-structure', check: v => v.length > 1 },
      { id: 'type-structure', check: v => v !== '' },
      { id: 'contact-nom', check: v => v.length > 1 },
      { id: 'contact-email', check: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) },
      { id: 'activite-desc', check: v => v.length > 5 },
    ];
    fields.forEach(f => {
      const el = document.getElementById(f.id);
      if (setFieldError(el, !f.check(el.value.trim()) || !el.checkValidity())) ok = false;
    });
  }
  document.querySelectorAll(`#step${step} input:not([type="radio"]):not([type="checkbox"]), #step${step} textarea`).forEach(field => {
    if (!field.checkValidity() || field.maxLength > 0 && field.value.length > field.maxLength) {
      setFieldError(field, true);
      ok = false;
    }
  });
  if (!ok) {
    const invalid = document.querySelector(`#step${step} [aria-invalid="true"]`);
    invalid?.focus();
    document.getElementById('stepAnnouncement').textContent = 'Vérifiez les champs signalés avant de continuer.';
  }
  return ok;
}

function goStep(n) {
  if (briefSending) return;
  if (n > currentStep && !validate(currentStep)) return;
  if (n === 3) updateTarifSuggestion();
  if (n === 5) buildRecap();
  document.getElementById('step' + currentStep).classList.remove('active');
  document.getElementById('step' + n).classList.add('active');
  // progress
  document.querySelectorAll('.progress-step').forEach(s => {
    const sn = parseInt(s.dataset.step);
    s.classList.remove('active', 'done');
    if (sn < n) s.classList.add('done');
    if (sn === n) s.classList.add('active');
    if (sn === n) s.setAttribute('aria-current', 'step');
    else s.removeAttribute('aria-current');
  });
  currentStep = n;
  const stepPanel = document.getElementById('step' + n);
  stepPanel.focus({ preventScroll: true });
  document.getElementById('stepAnnouncement').textContent = `Étape ${n} sur 5 : ${['Vous', 'Contenu', 'Tarif', 'Design', 'Récapitulatif'][n - 1]}`;
  window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

function buildRecap() {
  // VOUS
  const nom = document.getElementById('nom-structure').value;
  const type = document.getElementById('type-structure').value;
  const contact = document.getElementById('contact-nom').value;
  const email = document.getElementById('contact-email').value;
  const tel = document.getElementById('contact-tel').value;
  const ville = document.getElementById('contact-ville').value;
  const activite = document.getElementById('activite-desc').value;
  const siteExistant = document.querySelector('input[name="site-existant"]:checked')?.value;

  document.getElementById('recap-vous').innerHTML = `
    <div class="recap-title">👤 Vous</div>
    <div class="recap-row"><span class="recap-label">Structure</span><span class="recap-value">${escHtml(nom) || '-'}</span></div>
    <div class="recap-row"><span class="recap-label">Type</span><span class="recap-value">${escHtml(type) || '-'}</span></div>
    <div class="recap-row"><span class="recap-label">Contact</span><span class="recap-value">${escHtml(contact) || '-'}</span></div>
    <div class="recap-row"><span class="recap-label">Email</span><span class="recap-value">${escHtml(email) || '-'}</span></div>
    ${tel ? `<div class="recap-row"><span class="recap-label">Téléphone</span><span class="recap-value">${escHtml(tel)}</span></div>` : ''}
    ${ville ? `<div class="recap-row"><span class="recap-label">Ville</span><span class="recap-value">${escHtml(ville)}</span></div>` : ''}
    <div class="recap-row"><span class="recap-label">Activité</span><span class="recap-value">${escHtml(activite) || '-'}</span></div>
    <div class="recap-row"><span class="recap-label">Site existant</span><span class="recap-value">${siteExistant === 'oui' ? 'Oui - refonte' : 'Non - 1er site'}</span></div>
  `;

  // TARIFICATION
  const tarifMode = document.querySelector('input[name="tarif-mode"]:checked')?.value || 'forfait';
  const maintenanceChoice = pricing.maintenanceByKey(document.getElementById('maintenance-choix').value);
  const maintenance = maintenanceChoice ? `${maintenanceChoice.label}${maintenanceChoice.price ? ` — ${maintenanceChoice.price} €/mois` : ''}` : '-';
  const domaine = document.querySelector('input[name="domaine"]:checked')?.value || '-';
  const domaineNom = document.getElementById('domaine-nom').value;
  const domaineLabel = domaine === 'non' ? 'Pas encore - à acheter' : domaine === 'oui' ? 'Oui, déjà acheté' : 'Adresse gratuite offerte par l\'hébergeur';

  let tarifRow;
  if (tarifMode === 'forfait') {
    const formule = pricing.formuleByKey(document.querySelector('input[name="formule"]:checked')?.value);
    tarifRow = `<div class="recap-row"><span class="recap-label">Formule</span><span class="recap-formule-badge">${formule.name} — ${formule.price} €</span></div>`;
  } else {
    const modules = Array.from(briefModulesList.querySelectorAll('input[type="checkbox"]:checked')).map(c => pricing.moduleByKey(c.value)?.label || c.value);
    const total = document.getElementById('brief-alacarte-total').textContent;
    tarifRow = `
      <div class="recap-row"><span class="recap-label">Mode</span><span class="recap-value">Sur mesure à la carte</span></div>
      <div class="recap-row"><span class="recap-label">Modules</span><span class="recap-value">${modules.length ? modules.join(', ') : 'Base seule'}</span></div>
      <div class="recap-row"><span class="recap-label">Total estimé</span><span class="recap-formule-badge">${total}</span></div>
    `;
  }

  document.getElementById('recap-formule').innerHTML = `
    <div class="recap-title">💰 Tarification</div>
    ${tarifRow}
    ${mediaConstraints().estimationStatus === 'custom' ? `<p class="scope-warning">Montant partiel — devis personnalisé nécessaire. ${escHtml(mediaConstraints().estimationReasons.join(' '))}</p>` : ''}
    <div class="recap-row"><span class="recap-label">Maintenance</span><span class="recap-value">${maintenance}</span></div>
    <div class="recap-row"><span class="recap-label">Nom de domaine</span><span class="recap-value">${domaineLabel}${domaineNom ? ' - ' + escHtml(domaineNom) : ''}</span></div>
  `;

  // CONTENU
  const sections = Array.from(document.querySelectorAll('input[name="sections"]:checked')).map(c => c.value);
  const photos = document.getElementById('photos-dispo').value;
  const photosNb = document.getElementById('photos-nb').selectedOptions[0].textContent;
  const videos = document.querySelector('input[name="videos"]:checked')?.value;
  const logo = document.getElementById('logo-dispo').value;
  const textes = document.getElementById('textes-dispo').value;
  const photoLabel = { 'oui-bonnes': 'Oui - bonnes photos', 'oui-peu': 'Quelques photos', 'non-libres': 'Non - photos libres de droits', 'non-aide': 'Non - besoin de conseils' };
  const logoLabel = { 'oui-pro': 'Oui - bonne qualité', 'oui-moyen': 'Oui - qualité moyenne', 'non': 'Non' };
  document.getElementById('recap-contenu').innerHTML = `
    <div class="recap-title">📄 Contenu</div>
    <div class="recap-row"><span class="recap-label">Sections</span><span class="recap-value">${sections.length ? sections.join(', ') : '-'}</span></div>
    <div class="recap-row"><span class="recap-label">Photos</span><span class="recap-value">${photoLabel[photos] || photos || '-'} ${photosNb ? '- ' + photosNb : ''}</span></div>
    <div class="recap-row"><span class="recap-label">Vidéos</span><span class="recap-value">${videos === 'non' ? 'Aucune' : videos + ' vidéo(s)'}</span></div>
    <div class="recap-row"><span class="recap-label">Logo</span><span class="recap-value">${logoLabel[logo] || logo || '-'}</span></div>
    <div class="recap-row"><span class="recap-label">Textes</span><span class="recap-value">${textes || '-'}</span></div>
  `;

  // DESIGN
  const style = document.querySelector('input[name="style"]:checked')?.value || '-';
  const couleursTexte = document.getElementById('couleurs-texte').value;
  const refs = document.getElementById('refs-sites').value;
  const refNon = document.getElementById('refs-non').value;
  document.getElementById('recap-design').innerHTML = `
    <div class="recap-title">🎨 Design</div>
    <div class="recap-row"><span class="recap-label">Style</span><span class="recap-value">${style}</span></div>
    <div class="recap-row">
      <span class="recap-label">Couleurs</span>
      <span class="recap-value" style="display:flex;align-items:center;gap:0.5rem">
        <span style="width:20px;height:20px;border-radius:50%;background:${selectedColor1};display:inline-block;border:1px solid #ddd"></span>
        <span style="width:20px;height:20px;border-radius:50%;background:${selectedColor2};display:inline-block;border:1px solid #ddd"></span>
        ${couleursTexte ? '- ' + escHtml(couleursTexte) : ''}
      </span>
    </div>
    ${refs ? `<div class="recap-row"><span class="recap-label">Références</span><span class="recap-value">${escHtml(refs)}</span></div>` : ''}
    ${refNon ? `<div class="recap-row"><span class="recap-label">À éviter</span><span class="recap-value">${escHtml(refNon)}</span></div>` : ''}
  `;
}

function getTurnstileToken(containerId) {
  const el = document.querySelector('#' + containerId + ' [name="cf-turnstile-response"]');
  return el ? el.value : '';
}

function collectData() {
  return {
    ...mediaConstraints(),
    nom: document.getElementById('nom-structure').value,
    type: document.getElementById('type-structure').value,
    contact: document.getElementById('contact-nom').value,
    email: document.getElementById('contact-email').value,
    tel: document.getElementById('contact-tel').value,
    ville: document.getElementById('contact-ville').value,
    activite: document.getElementById('activite-desc').value,
    siteExistant: document.querySelector('input[name="site-existant"]:checked')?.value,
    siteUrl: document.getElementById('site-url').value,
    tarifMode: document.querySelector('input[name="tarif-mode"]:checked')?.value || 'forfait',
    formule: document.querySelector('input[name="formule"]:checked')?.value || 'Non précisé',
    // moduleKeys est la source de vérité utilisée par le serveur pour recalculer le total ;
    // modulesChoisis/totalEstime restent envoyés pour le fallback mailto (pas de serveur dans ce cas).
    moduleKeys: Array.from(briefModulesList.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value),
    modulesChoisis: Array.from(briefModulesList.querySelectorAll('input[type="checkbox"]:checked')).map(c => pricing.moduleByKey(c.value)?.label || c.value),
    totalEstime: pricing.alaCarteTotal(Array.from(briefModulesList.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value)),
    maintenance: document.getElementById('maintenance-choix').value,
    domaine: document.querySelector('input[name="domaine"]:checked')?.value,
    domaineNom: document.getElementById('domaine-nom').value,
    sections: Array.from(document.querySelectorAll('input[name="sections"]:checked')).map(c => c.value),
    photos: document.getElementById('photos-dispo').value,
    photosNb: document.getElementById('photos-nb').value,
    videos: document.querySelector('input[name="videos"]:checked')?.value,
    logo: document.getElementById('logo-dispo').value,
    textes: document.getElementById('textes-dispo').value,
    fbLink: document.getElementById('link-fb').value,
    igLink: document.getElementById('link-ig').value,
    ytLink: document.getElementById('link-yt').value,
    autreLink: document.getElementById('link-autre').value,
    style: document.querySelector('input[name="style"]:checked')?.value,
    couleur1: selectedColor1,
    couleur2: selectedColor2,
    couleursTexte: document.getElementById('couleurs-texte').value,
    refs: document.getElementById('refs-sites').value,
    refNon: document.getElementById('refs-non').value,
    infos: document.getElementById('infos-plus').value,
    website: document.getElementById('b-website').value,
    ts: formLoadedAt,
    turnstileToken: getTurnstileToken('turnstile-brief'),
  };
}

function mailtoFallback(data) {
  const domaineLabel = data.domaine === 'non' ? 'Non, à acheter' : data.domaine === 'oui' ? 'Oui, déjà acheté' : 'Adresse gratuite offerte par l\'hébergeur';
  const formule = pricing.formuleByKey(data.formule);
  const formuleLabel = formule ? `${formule.name} — ${formule.price} €` : 'Non précisée';
  const maintenance = pricing.maintenanceByKey(data.maintenance);
  const maintenanceLabel = maintenance ? `${maintenance.label}${maintenance.price ? ` — ${maintenance.price} €/mois` : ''}` : 'Aucune';
  const tarifLabel = data.tarifMode === 'forfait' ? formuleLabel : `Sur mesure - ${data.totalEstime}€`;
  const subject = encodeURIComponent(`Brief AbiWeb - ${data.nom} (${tarifLabel})`);
  const body = encodeURIComponent(
`=== BRIEF CLIENT ABIWEB ===

--- CONTACT ---
Structure : ${data.nom}
Type : ${data.type}
Nom contact : ${data.contact}
Email : ${data.email}
Téléphone : ${data.tel || 'Non renseigné'}
Ville : ${data.ville || 'Non renseignée'}
Activité : ${data.activite}
Site existant : ${data.siteExistant === 'oui' ? 'Oui - refonte' : 'Non - 1er site'}
Adresse du site : ${data.siteUrl || 'Non renseignée'}

--- TARIFICATION ---
Mode : ${data.tarifMode === 'forfait' ? 'Formule clé en main' : 'Sur mesure à la carte'}
${data.tarifMode === 'forfait' ? 'Formule : ' + formuleLabel : 'Modules : ' + (data.modulesChoisis.join(', ') || 'Base seule') + '\nTotal estimé : ' + data.totalEstime + '€'}
${data.estimationStatus === 'custom' ? 'Montant partiel — devis personnalisé nécessaire : ' + data.estimationReasons.join(' ') : ''}
Maintenance : ${maintenanceLabel}
Domaine : ${domaineLabel}${data.domaineNom ? ' - ' + data.domaineNom : ''}

--- CONTENU ---
Sections souhaitées : ${data.sections.join(', ') || 'Non précisé'}
Photos : ${data.photos || 'Non précisé'} - Nombre : ${pricing.PHOTO_OPTIONS.find(option => option.value === data.photosNb)?.label || 'Non précisé'}
Vidéos : ${data.videos || 'Non précisé'}
Logo : ${data.logo || 'Non précisé'}
Textes : ${data.textes || 'Non précisé'}
Facebook : ${data.fbLink || 'Aucun'}
Instagram : ${data.igLink || 'Aucun'}
YouTube : ${data.ytLink || 'Aucun'}
Autre lien : ${data.autreLink || 'Aucun'}

--- DESIGN ---
Style : ${data.style || 'Non précisé'}
Couleur principale : ${data.couleur1}
Couleur secondaire : ${data.couleur2}
Précisions couleurs : ${data.couleursTexte || 'Aucune'}
Références : ${data.refs || 'Aucune'}
À éviter : ${data.refNon || 'Aucun'}

--- INFOS COMPLÉMENTAIRES ---
${data.infos || 'Aucune'}
`);
  window.location.href = `mailto:contact@abiweb.fr?subject=${subject}&body=${body}`;
}

async function submitBrief() {
  if (briefSending) return;
  for (let step = 1; step < 5; step++) {
    if (!validate(step)) {
      goStep(step);
      validate(step);
      return;
    }
  }
  const data = collectData();
  const btn = document.getElementById('submitBriefBtn');
  const originalLabel = btn.textContent;
  briefSending = true;
  document.getElementById('briefForm').setAttribute('aria-busy', 'true');
  document.querySelectorAll('[data-goto]').forEach(button => { button.disabled = true; });
  btn.disabled = true;
  document.getElementById('retryBriefBtn').disabled = true;
  btn.textContent = 'Envoi en cours…';
  document.getElementById('error-brief').classList.remove('visible');

  try {
    await postForm('/api/send-brief', briefSubmission.prepare(data));
    briefSubmission.reset();

    document.getElementById('error-brief').classList.remove('visible');
    document.getElementById('step5').classList.remove('active');
    document.getElementById('successScreen').classList.add('visible');
    document.getElementById('successScreen').focus();
    document.getElementById('stepAnnouncement').textContent = 'Projet envoyé avec succès.';
  } catch (error) {
    document.getElementById('error-brief-text').textContent = formErrorMessage(error);
    document.getElementById('error-brief').classList.add('visible');
  } finally {
    briefSending = false;
    document.getElementById('briefForm').setAttribute('aria-busy', 'false');
    document.querySelectorAll('[data-goto]').forEach(button => { button.disabled = false; });
    btn.disabled = false;
    btn.textContent = originalLabel;
    document.getElementById('retryBriefBtn').disabled = false;
    // Jeton Turnstile a usage unique - il faut en redemander un pour le prochain essai.
    if (window.turnstile) window.turnstile.reset(document.getElementById('turnstile-brief'));
  }
}

var retryBriefBtn = document.getElementById('retryBriefBtn');
if (retryBriefBtn) {
  retryBriefBtn.addEventListener('click', function () {
    document.getElementById('error-brief').classList.remove('visible');
    submitBrief();
  });
}

var mailtoBriefLink = document.getElementById('mailtoBriefLink');
if (mailtoBriefLink) {
  mailtoBriefLink.addEventListener('click', function (e) {
    e.preventDefault();
    mailtoFallback(collectData());
  });
}

// Navigation par étapes + envoi final (attributs data-* pour rester compatible avec la CSP sans 'unsafe-inline')
document.querySelectorAll('[data-goto]').forEach(function (btn) {
  btn.addEventListener('click', function () { goStep(Number(btn.dataset.goto)); });
});
document.getElementById('briefForm').addEventListener('submit', event => {
  event.preventDefault();
  if (currentStep < 5) goStep(currentStep + 1);
  else submitBrief();
});
document.querySelectorAll('#briefForm input, #briefForm textarea, #briefForm select').forEach(field => {
  field.addEventListener('input', () => setFieldError(field, false));
  field.addEventListener('change', updateScopeWarning);
});
