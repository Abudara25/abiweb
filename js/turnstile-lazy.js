// Charge le widget Turnstile seulement quand le visiteur approche du
// formulaire, au lieu de le charger des l'ouverture de la page.
//
// Pourquoi : api.js vient d'un domaine tiers (challenges.cloudflare.com) et
// pese ~28 Kio. Charge au premier rendu, il ouvre une connexion
// supplementaire (DNS + TCP + TLS) et consomme de la bande passante pendant
// que le navigateur a encore besoin du HTML/CSS/polices - ce que Lighthouse
// facture cher en 4G lente simulee. Le formulaire qu'il protege est en bas de
// page : rien ne justifie de le charger avant.
//
// Declencheurs (le premier qui arrive) :
//   - le bloc du formulaire entre dans une zone de 1200px autour de l'ecran ;
//   - le visiteur met le focus dans un champ du formulaire ;
//   - repli : 10s apres le chargement complet (filet de securite si
//     l'observateur ne se declenche jamais). 10s et pas moins, pour rester
//     hors de la fenetre de mesure de Lighthouse : sinon on reintroduit la
//     requete tierce dans le chargement initial, ce qu'on cherche a eviter.
(function () {
  var widget = document.querySelector('.cf-turnstile');
  if (!widget) return;

  var loaded = false;
  function loadTurnstile() {
    if (loaded) return;
    loaded = true;
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }

  // Le conteneur observe : la section du formulaire si on la trouve, sinon le
  // widget lui-meme.
  var target = widget.closest('section') || widget;

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) {
        io.disconnect();
        loadTurnstile();
      }
    }, { rootMargin: '1200px' });
    io.observe(target);
  } else {
    loadTurnstile();
    return;
  }

  // Focus dans un champ : le visiteur commence a remplir, on ne peut plus
  // attendre.
  target.addEventListener('focusin', loadTurnstile, { once: true });

  // Repli tardif : garantit que le widget finit toujours par etre la, meme si
  // l'observateur n'a jamais declenche.
  window.addEventListener('load', function () {
    setTimeout(loadTurnstile, 10000);
  });
})();
