(function initialiseBanner() {
  // Les pages peuvent charger analytics-loader avec defer.
  if (!window.abiwebConsent) {
    document.addEventListener('DOMContentLoaded', initialiseBanner, { once: true });
    return;
  }
  // Le bandeau porte son propre HTML au lieu d'etre duplique dans les 12
  // pages qui l'utilisent (une seule source a corriger desormais). Injecte
  // de façon synchrone, au meme point du flux document que l'ancien bloc
  // statique - avant le premier rendu puisque ce script n'est ni deferre ni
  // async et se trouve en fin de <body>, donc aucune image de shift entre
  // "sans bandeau" et "avec bandeau" pour le CLS (verifie par mesure directe
  // avant deploiement, voir memoire feedback_cls_font_swap).
  document.body.insertAdjacentHTML('beforeend', [
    '<div class="cookie-banner" id="cookieBanner" role="region" aria-label="Préférences de mesure d’audience">',
    '<p>Ce site utilise des cookies de mesure d\'audience (Google Analytics), déposés uniquement avec votre accord. <a href="/politique-de-confidentialite">En savoir plus</a></p>',
    '<div class="cookie-actions">',
    '<button type="button" id="cookieRefuse">Continuer sans accepter</button>',
    '<button type="button" id="cookieAccept">Accepter</button>',
    '</div>',
    '</div>',
  ].join(''));

  var banner = document.getElementById('cookieBanner');
  var previousFocus = null;
  function choose(value) {
    banner.classList.remove('visible');
    window.abiwebConsent.set(value);
    if (previousFocus) previousFocus.focus();
  }
  document.getElementById('cookieAccept').addEventListener('click', function () { choose('granted'); });
  document.getElementById('cookieRefuse').addEventListener('click', function () { choose('denied'); });
  if (!window.abiwebConsent.get()) banner.classList.add('visible');
  function reopenBanner() {
    previousFocus = document.activeElement;
    banner.classList.add('visible');
    document.getElementById('cookieRefuse').focus();
  }
  window.abiwebCookieChoice = reopenBanner;

  // Lien "gérer mes préférences cookies" dans le corps des pages légales.
  document.querySelectorAll('[data-cookie-prefs]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      reopenBanner();
    });
  });
})();
