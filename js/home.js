(function () {
  var pricing = window.AbiWebPricing;
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
      suggestionEl.innerHTML = 'Vous avez sélectionné l\'équivalent de la formule <strong>' + suggestion.formule.name +
        '</strong>, économisez <strong>' + suggestion.savings + ' €</strong> en prenant le pack (' + suggestion.packTotal + ' € au lieu de ' + total + ' €).';
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
    // .plan et .step retires temporairement : GSAP gere seul leur animation sur la branche test-animations (voir gsap-test.js)
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
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        window.scrollBy(0, e.deltaY);
        e.preventDefault();
      }
    }, { passive: false });
  }

  // Onglets du formulaire (contact rapide / brief)
  document.querySelectorAll('.form-tab').forEach(function (btn) {
    btn.addEventListener('click', function () { switchTab(btn.dataset.tab, btn); });
  });

  var contactSubmitBtn = document.getElementById('contactSubmitBtn');
  if (contactSubmitBtn) {
    contactSubmitBtn.addEventListener('click', function () { submitContact(contactSubmitBtn); });
  }

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
    var rotatorWidths = Array.prototype.map.call(rotatorItems, function (item) { return item.offsetWidth; });
    rotator.style.width = rotatorWidths[rotatorIndex] + 'px';
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
  document.querySelectorAll('.form-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.form-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  btn.classList.add('active');
}

function markError(id, hasError) {
  document.getElementById(id).closest('.form-group').classList.toggle('has-error', hasError);
  return hasError;
}

// Efface l'erreur du champ dès que le visiteur le corrige
document.querySelectorAll('#tab-contact input, #tab-contact textarea').forEach(el => {
  el.addEventListener('input', () => el.closest('.form-group').classList.remove('has-error'));
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
  const subject = encodeURIComponent('Demande de devis AbiWeb - ' + data.nom);
  const body = encodeURIComponent(
    'Nom : ' + data.nom + '\n' +
    'Email : ' + data.email + '\n' +
    (data.tel ? 'Téléphone : ' + data.tel + '\n' : '') +
    (data.formule ? 'Formule : ' + data.formule + '\n' : '') +
    '\nMessage :\n' + data.message
  );
  window.location.href = 'mailto:contact@abiweb.fr?subject=' + subject + '&body=' + body;
}

function getTurnstileToken(containerId) {
  const el = document.querySelector('#' + containerId + ' [name="cf-turnstile-response"]');
  return el ? el.value : '';
}

async function submitContact(btn) {
  const nom = document.getElementById('c-nom').value.trim();
  const email = document.getElementById('c-email').value.trim();
  const message = document.getElementById('c-message').value.trim();
  let invalid = false;
  invalid = markError('c-nom', nom.length < 2) || invalid;
  invalid = markError('c-email', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || invalid;
  invalid = markError('c-message', message.length < 5) || invalid;
  if (invalid) return;
  const data = {
    nom, email, message,
    formule: document.getElementById('c-formule').value,
    tel: document.getElementById('c-tel').value,
    website: document.getElementById('c-website').value,
    ts: window.abiwebFormLoadedAt,
    turnstileToken: getTurnstileToken('turnstile-contact'),
  };
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Envoi en cours…';

  try {
    const resp = await fetch('/api/send-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (resp.status === 429) throw new Error('rate_limited');
    if (!resp.ok) throw new Error('send_failed');
    document.getElementById('error-contact').classList.remove('visible');
    document.getElementById('success-contact').style.display = 'block';
    ['c-nom', 'c-email', 'c-tel', 'c-message'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('c-formule').value = '';
  } catch (err) {
    const msg = document.getElementById('error-contact-text');
    if (msg) {
      msg.textContent = err.message === 'rate_limited'
        ? "⚠️ Trop d'envois en peu de temps. Patientez quelques minutes, ou écrivez-moi directement par email."
        : "⚠️ L'envoi automatique a échoué. Réessayez, ou écrivez-moi directement par email.";
    }
    document.getElementById('error-contact').classList.add('visible');
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
    // Jeton Turnstile a usage unique - il faut en redemander un pour le prochain essai.
    if (window.turnstile) window.turnstile.reset(document.getElementById('turnstile-contact'));
  }
}
