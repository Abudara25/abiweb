import * as pricing from './pricing-catalogue.js';
import { CONTACT_LIMITS } from './form-rules.js';
import { applyFieldLimits, setFieldError, createSubmissionState, postForm, formErrorMessage } from './form-ui.js';

const contactSubmission = createSubmissionState();
let contactSending = false;

(function () {
  var selectedModules = [];
  window.abiwebFormLoadedAt = Date.now();

  var listEl = document.getElementById('simulatorModules');
  document.getElementById('simulatorBaseDesc').textContent = pricing.BASE_LABEL;
  document.getElementById('simulatorBasePrice').textContent = pricing.BASE_PRICE + ' €';

  pricing.MODULES.forEach(function (mod) {
    var item = document.createElement('label');
    item.className = 'sim-module-item';
    item.innerHTML =
      '<span class="sim-module-check"><input type="checkbox" value="' + mod.key + '" />' +
      '<span class="sim-module-text"><span class="sim-module-label">' + mod.label + '</span>' +
      '<span class="sim-module-desc">' + mod.desc + '</span></span></span>' +
      '<span class="sim-module-price">+' + mod.price + ' €</span>';
    listEl.appendChild(item);
  });

  function updateTotal() {
    var checkboxes = listEl.querySelectorAll('input[type="checkbox"]');
    selectedModules = Array.prototype.filter.call(checkboxes, function (c) { return c.checked; })
      .map(function (c) { return c.value; });

    checkboxes.forEach(function (c) { c.closest('.sim-module-item').classList.toggle('checked', c.checked); });

    var total = pricing.alaCarteTotal(selectedModules);
    document.getElementById('simulatorTotal').textContent = total + ' €';

    var suggestionEl = document.getElementById('simulatorSuggestion');
    var suggestion = pricing.bestPackSuggestion(selectedModules);
    if (suggestion) {
      suggestionEl.classList.add('visible');
      const extra = suggestion.extraKeys.length ? ' + options sélectionnées' : '';
      const included = suggestion.includedExtraKeys.length ? ' Ce pack inclut aussi des fonctions supplémentaires.' : '';
      suggestionEl.innerHTML = 'La formule <strong>' + suggestion.formule.name + extra +
        '</strong> couvre vos besoins pour <strong>' + suggestion.packTotal + ' €</strong>, soit ' + suggestion.savings + ' € d’économie.' + included;
    } else {
      suggestionEl.classList.remove('visible');
      suggestionEl.innerHTML = '';
    }
  }

  listEl.addEventListener('change', updateTotal);
  updateTotal();

  document.getElementById('simulatorCta').addEventListener('click', function () {
    var total = pricing.alaCarteTotal(selectedModules);
    var suggestion = pricing.bestPackSuggestion(selectedModules);
    var selection = {
      modules: selectedModules,
      total: total,
      suggestion: suggestion ? { formule: suggestion.formule.key, packTotal: suggestion.packTotal, savings: suggestion.savings } : null,
    };
    try { sessionStorage.setItem('abiweb_pricing_selection', JSON.stringify(selection)); } catch {}
    window.location.href = '/devis';
  });

  // Les boutons "Choisir X" préselectionnent la formule sur /devis
  document.querySelectorAll('.plan-btn[data-formule]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      try { sessionStorage.setItem('abiweb_pricing_selection', JSON.stringify({ formule: btn.dataset.formule })); } catch {}
    });
  });

  // Menu mobile
  var burger = document.getElementById('navBurger');
  var menu = document.getElementById('navMenu');
  burger.addEventListener('click', function () {
    var open = menu.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  menu.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      menu.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    });
  });

  // Apparition douce des cartes au scroll
  if ('IntersectionObserver' in window) {
    var revealEls = document.querySelectorAll('.included-item, .integ-group, .hosting-card, .realisation-card');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el, i) {
      el.classList.add('reveal');
      el.style.transitionDelay = (i % 3) * 60 + 'ms';
      io.observe(el);
    });
  }

  // Carrousel horizontal "Mes réalisations" (flèches + points + snap au scroll/swipe)
  var realisationsScroll = document.getElementById('realisationsScroll');
  if (realisationsScroll) {
    var realisationsCards = Array.prototype.slice.call(realisationsScroll.querySelectorAll('.realisation-card'));
    var realisationsDots = Array.prototype.slice.call(document.querySelectorAll('#realisationsDots .realisations-dot'));
    var realisationsPrev = document.getElementById('realisationsPrev');
    var realisationsNext = document.getElementById('realisationsNext');

    var currentRealisationIndex = function () {
      return Math.round(realisationsScroll.scrollLeft / realisationsScroll.clientWidth);
    };
    var scrollToRealisation = function (i) {
      realisationsCards[i].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    };
    var updateRealisationsNav = function () {
      var i = currentRealisationIndex();
    realisationsDots.forEach(function (dot, di) { dot.classList.toggle('active', di === i); });
      realisationsDots.forEach(function (dot, di) { dot.setAttribute('aria-current', di === i ? 'true' : 'false'); });
      realisationsPrev.disabled = i <= 0;
      realisationsNext.disabled = i >= realisationsCards.length - 1;
    };

    realisationsDots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { scrollToRealisation(i); });
    });
    realisationsPrev.addEventListener('click', function () { scrollToRealisation(Math.max(0, currentRealisationIndex() - 1)); });
    realisationsNext.addEventListener('click', function () { scrollToRealisation(Math.min(realisationsCards.length - 1, currentRealisationIndex() + 1)); });

    var realisationsScrollRaf = null;
    realisationsScroll.addEventListener('scroll', function () {
      if (realisationsScrollRaf) return;
      realisationsScrollRaf = requestAnimationFrame(function () { updateRealisationsNav(); realisationsScrollRaf = null; });
    });
    // En rAF : la lecture initiale de scrollLeft/clientWidth juste apres les
    // mutations de style du reveal IntersectionObserver forcait un reflow
    // synchrone (254ms mesures en mobile PageSpeed). Reporter au prochain
    // frame laisse le navigateur peindre normalement avant de lire la geometrie.
    requestAnimationFrame(updateRealisationsNav);

    // Un carrousel horizontal avec scroll-snap peut avaler le scroll vertical
    // de la souris/trackpad quand le curseur est dessus, bloquant le défilement
    // de la page. On force le geste vertical à faire défiler la page normalement.
    realisationsScroll.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        window.scrollBy(0, e.deltaY);
        e.preventDefault();
      }
    }, { passive: false });
  }

  // Onglets du formulaire (contact rapide / brief)
  document.querySelectorAll('.form-tab').forEach(function (btn) {
    btn.addEventListener('click', function () { switchTab(btn.dataset.tab, btn); });
  });

  document.getElementById('tab-contact').addEventListener('submit', function (event) {
    event.preventDefault();
    submitContact(document.getElementById('contactSubmitBtn'));
  });

  // Mot rotatif du H1 (associations / artisans / auto-entrepreneurs...)
  var rotator = document.getElementById('wordRotator');
  if (rotator && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var rotatorItems = rotator.querySelectorAll('.word-rotator-item');
    var rotatorIndex = 0;
    // La largeur du conteneur suit le mot actuellement affiche (pas toujours
    // celle du mot le plus long), pour que "pour TPE" reste colle au mot
    // precedent au lieu de laisser un grand vide.
    // Largeurs mesurees une seule fois au chargement pour eviter un reflow force
    // a chaque rotation (offsetWidth lu juste apres une mutation de classList).
    var rotatorWidths;
    const measureWords = function () {
      rotatorWidths = Array.prototype.map.call(rotatorItems, function (item) { return item.offsetWidth; });
      rotator.style.width = rotatorWidths[rotatorIndex] + 'px';
    };
    measureWords();
    document.fonts.ready.then(measureWords);
    window.addEventListener('resize', measureWords);
    if (rotatorItems.length > 1) {
      setInterval(function () {
        var next = (rotatorIndex + 1) % rotatorItems.length;
        rotatorItems[rotatorIndex].classList.remove('is-active');
        rotatorItems[rotatorIndex].classList.add('is-leaving');
        rotatorItems[next].classList.add('is-active');
        rotator.style.width = rotatorWidths[next] + 'px';
        (function (leaving) {
          setTimeout(function () { leaving.classList.remove('is-leaving'); }, 450);
        })(rotatorItems[rotatorIndex]);
        rotatorIndex = next;
      }, 2400);
    }
  }
})();

function switchTab(tab, btn) {
  document.querySelectorAll('.form-tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
    t.tabIndex = -1;
  });
  document.querySelectorAll('.form-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  btn.classList.add('active');
  btn.setAttribute('aria-selected', 'true');
  btn.tabIndex = 0;
}

function markError(id, hasError) {
  return setFieldError(document.getElementById(id), hasError);
}

applyFieldLimits({ nom: 'c-nom', email: 'c-email', tel: 'c-tel', message: 'c-message' }, CONTACT_LIMITS);
document.querySelectorAll('.form-tab').forEach((tab, index, tabs) => {
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    switchTab(tabs[next].dataset.tab, tabs[next]);
    tabs[next].focus();
  });
});

// Efface l'erreur du champ dès que le visiteur le corrige
document.querySelectorAll('#tab-contact input, #tab-contact textarea').forEach(el => {
  el.addEventListener('input', () => {
    setFieldError(el, false);
    document.getElementById('success-contact').style.display = 'none';
  });
});

var retryContactBtn = document.getElementById('retryContactBtn');
if (retryContactBtn) {
  retryContactBtn.addEventListener('click', function () {
    document.getElementById('error-contact').classList.remove('visible');
    submitContact(document.getElementById('contactSubmitBtn'));
  });
}

var mailtoContactLink = document.getElementById('mailtoContactLink');
if (mailtoContactLink) {
  mailtoContactLink.addEventListener('click', function (e) {
    e.preventDefault();
    mailtoFallbackContact({
      nom: document.getElementById('c-nom').value.trim(),
      email: document.getElementById('c-email').value.trim(),
      message: document.getElementById('c-message').value.trim(),
      tel: document.getElementById('c-tel').value,
      formule: document.getElementById('c-formule').value,
    });
  });
}

function mailtoFallbackContact(data) {
  const formule = pricing.formuleByKey(data.formule);
  const formuleLabel = formule ? `${formule.name} — ${formule.price} €`
    : ({ alacarte: 'Sur mesure à la carte', indecis: 'Je ne sais pas encore' }[data.formule] || '');
  const subject = encodeURIComponent('Demande de devis AbiWeb - ' + data.nom);
  const body = encodeURIComponent(
    'Nom : ' + data.nom + '\n' +
    'Email : ' + data.email + '\n' +
    (data.tel ? 'Téléphone : ' + data.tel + '\n' : '') +
    (formuleLabel ? 'Formule : ' + formuleLabel + '\n' : '') +
    '\nMessage :\n' + data.message
  );
  window.location.href = 'mailto:contact@abiweb.fr?subject=' + subject + '&body=' + body;
}

function getTurnstileToken(containerId) {
  const el = document.querySelector('#' + containerId + ' [name="cf-turnstile-response"]');
  return el ? el.value : '';
}

async function submitContact(btn) {
  if (contactSending) return;
  const nom = document.getElementById('c-nom').value.trim();
  const email = document.getElementById('c-email').value.trim();
  const message = document.getElementById('c-message').value.trim();
  let invalid = false;
  invalid = markError('c-nom', nom.length < 2 || nom.length > CONTACT_LIMITS.nom) || invalid;
  invalid = markError('c-email', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > CONTACT_LIMITS.email) || invalid;
  invalid = markError('c-message', message.length < 5 || message.length > CONTACT_LIMITS.message) || invalid;
  if (invalid) {
    document.querySelector('#tab-contact [aria-invalid="true"]').focus();
    return;
  }
  const data = {
    nom, email, message,
    formule: document.getElementById('c-formule').value,
    tel: document.getElementById('c-tel').value,
    website: document.getElementById('c-website').value,
    ts: window.abiwebFormLoadedAt,
    turnstileToken: getTurnstileToken('turnstile-contact'),
  };
  const originalLabel = btn.textContent;
  contactSending = true;
  document.getElementById('tab-contact').setAttribute('aria-busy', 'true');
  ['c-nom', 'c-email', 'c-tel', 'c-message', 'c-formule'].forEach(id => { document.getElementById(id).disabled = true; });
  document.getElementById('retryContactBtn').disabled = true;
  btn.disabled = true;
  btn.textContent = 'Envoi en cours…';
  document.getElementById('error-contact').classList.remove('visible');
  document.getElementById('success-contact').style.display = 'none';

  try {
    await postForm('/api/send-contact', contactSubmission.prepare(data));
    contactSubmission.reset();
    document.getElementById('error-contact').classList.remove('visible');
    document.getElementById('success-contact').style.display = 'block';
    ['c-nom', 'c-email', 'c-tel', 'c-message'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('c-formule').value = '';
    document.getElementById('c-message').dispatchEvent(new window.Event('input'));
    document.getElementById('success-contact').style.display = 'block';
  } catch (err) {
    const msg = document.getElementById('error-contact-text');
    if (msg) {
      msg.textContent = formErrorMessage(err);
    }
    document.getElementById('error-contact').classList.add('visible');
  } finally {
    contactSending = false;
    document.getElementById('tab-contact').setAttribute('aria-busy', 'false');
    ['c-nom', 'c-email', 'c-tel', 'c-message', 'c-formule'].forEach(id => { document.getElementById(id).disabled = false; });
    document.getElementById('retryContactBtn').disabled = false;
    btn.disabled = false;
    btn.textContent = originalLabel;
    // Jeton Turnstile a usage unique - il faut en redemander un pour le prochain essai.
    if (window.turnstile) window.turnstile.reset(document.getElementById('turnstile-contact'));
  }
}
