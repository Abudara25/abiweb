(function () {
  // Le bandeau porte son propre HTML au lieu d'etre duplique dans les 12
  // pages qui l'utilisent (une seule source a corriger desormais). Injecte
  // de façon synchrone, au meme point du flux document que l'ancien bloc
  // statique - avant le premier rendu puisque ce script n'est ni deferre ni
  // async et se trouve en fin de <body>, donc aucune image de shift entre
  // "sans bandeau" et "avec bandeau" pour le CLS (verifie par mesure directe
  // avant deploiement, voir memoire feedback_cls_font_swap).
  document.body.insertAdjacentHTML('beforeend', [
    '<div class="cookie-banner" id="cookieBanner">',
    '<p>Ce site utilise des cookies de mesure d\'audience (Google Analytics), déposés uniquement avec votre accord. <a href="/politique-de-confidentialite">En savoir plus</a></p>',
    '<div class="cookie-actions">',
    '<button id="cookieRefuse">Continuer sans accepter</button>',
    '<button id="cookieAccept">Accepter</button>',
    '</div>',
    '</div>',
  ].join(''));

  var banner = document.getElementById('cookieBanner');
  function choose(value) {
    localStorage.setItem('abiweb-consent', value);
    banner.classList.remove('visible');
    if (value === 'granted') abiwebLoadAnalytics();
  }
  document.getElementById('cookieAccept').addEventListener('click', function () { choose('granted'); });
  document.getElementById('cookieRefuse').addEventListener('click', function () { choose('denied'); });
  if (!localStorage.getItem('abiweb-consent')) banner.classList.add('visible');
  function reopenBanner() {
    localStorage.removeItem('abiweb-consent');
    banner.classList.add('visible');
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
