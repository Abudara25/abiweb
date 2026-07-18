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
    try { sessionStorage.setItem('abiweb_pricing_selection', JSON.stringify(selection)); } catch (e) {}
    window.location.href = '/devis';
  });

  // Les boutons "Choisir X" préselectionnent la formule sur /devis
  document.querySelectorAll('.plan-btn[data-formule]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      try { sessionStorage.setItem('abiweb_pricing_selection', JSON.stringify({ formule: btn.dataset.formule })); } catch (e) {}
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
    var revealEls = document.querySelectorAll('.plan, .step, .included-item, .integ-group, .hosting-card, .realisation-card');
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

  // Onglets "Exemples par secteur" (bascule l'iframe de démo)
  var secteurIframe = document.getElementById('secteurIframe');
  if (secteurIframe) {
    var secteurUrl = document.getElementById('secteurUrl');
    var secteurOpenLink = document.getElementById('secteurOpenLink');
    document.querySelectorAll('.secteur-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.secteur-tab').forEach(function (t) { t.classList.remove('active'); });
        btn.classList.add('active');
        var demo = btn.dataset.demo;
        secteurIframe.src = '/demos/' + demo + '/';
        secteurIframe.title = 'Exemple de site pour ' + btn.dataset.label;
        secteurUrl.textContent = 'abiweb.fr/demos/' + demo;
        secteurOpenLink.href = '/demos/' + demo + '/';
      });
    });
  }

  // Onglets du formulaire (contact rapide / brief)
  document.querySelectorAll('.form-tab').forEach(function (btn) {
    btn.addEventListener('click', function () { switchTab(btn.dataset.tab, btn); });
  });

  var contactSubmitBtn = document.getElementById('contactSubmitBtn');
  if (contactSubmitBtn) {
    contactSubmitBtn.addEventListener('click', function () { submitContact(contactSubmitBtn); });
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
    if (!resp.ok) throw new Error('send_failed');
    document.getElementById('success-contact').style.display = 'block';
    ['c-nom', 'c-email', 'c-tel', 'c-message'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('c-formule').value = '';
  } catch (e) {
    const fallback = confirm("L'envoi automatique a échoué. Voulez-vous ouvrir votre messagerie pour envoyer le message par email à la place ?");
    if (fallback) mailtoFallbackContact(data);
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}
