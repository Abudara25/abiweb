// Fichier de test GSAP — branche test-animations uniquement, jamais commité en l'état final.
// Effets volontairement exagérés pour être visibles sans ambiguïté pendant le test.
(function () {
  if (!window.gsap) return;
  gsap.registerPlugin(ScrollTrigger);

  // 1. Hero : fade-in + slide au chargement
  gsap.timeline({ defaults: { ease: 'power3.out', duration: 1.4 } })
    .from('.hero-eyebrow', { opacity: 0, y: 60, scale: 0.7 })
    .from('.hero h1', { opacity: 0, y: 90 }, '-=1.05')
    .from('.hero > p, .hero-note', { opacity: 0, y: 60 }, '-=1.0')
    .from('.hero .cta-group', { opacity: 0, y: 50, scale: 0.85 }, '-=0.9');

  // 2. Cartes "Pour qui" : cascade au scroll, avec rebond net
  gsap.fromTo('.audience-item',
    { opacity: 0, y: 90, rotate: -4 },
    {
      opacity: 1, y: 0, rotate: 0,
      duration: 1,
      stagger: 0.25,
      ease: 'back.out(1.7)',
      scrollTrigger: { trigger: '.audience-grid', start: 'top 85%' },
    }
  );

  // 2bis. Plans tarifaires : cascade au scroll, avec rebond net
  gsap.fromTo('.plan',
    { opacity: 0, y: 120, scale: 0.85 },
    {
      opacity: 1, y: 0, scale: 1,
      duration: 1,
      stagger: 0.25,
      ease: 'back.out(1.7)',
      scrollTrigger: { trigger: '.plans', start: 'top 85%' },
    }
  );

  // 3. "Comment ça marche" : ligne qui se dessine + etapes en cascade
  var stepsLineFill = document.getElementById('stepsLineFill');
  if (stepsLineFill) {
    gsap.to(stepsLineFill, {
      height: '100%',
      ease: 'none',
      scrollTrigger: { trigger: '.steps', start: 'top 70%', end: 'bottom 70%', scrub: 0.5 },
    });
  }
  // Chaque etape se revele individuellement quand elle arrive a l'ecran,
  // en phase avec la ligne (scrub) qui la rejoint au meme moment. Pas de
  // rebond ici : sur du texte lu en sequence, l'overshoot horizontal
  // (back.out) donnait un effet "vibrant" desagreable a la lecture.
  document.querySelectorAll('.step').forEach(function (step) {
    gsap.fromTo(step,
      { opacity: 0, y: 24 },
      {
        opacity: 1, y: 0,
        duration: 0.6,
        ease: 'power2.out',
        scrollTrigger: { trigger: step, start: 'top 85%' },
      }
    );
  });

  // 4. Bouton magnetique sur le CTA principal du hero
  var magneticBtn = document.querySelector('.hero .btn-primary');
  if (magneticBtn) {
    var magnetX = gsap.quickTo(magneticBtn, 'x', { duration: 0.4, ease: 'power3.out' });
    var magnetY = gsap.quickTo(magneticBtn, 'y', { duration: 0.4, ease: 'power3.out' });
    magneticBtn.addEventListener('mousemove', function (e) {
      var rect = magneticBtn.getBoundingClientRect();
      var relX = e.clientX - (rect.left + rect.width / 2);
      var relY = e.clientY - (rect.top + rect.height / 2);
      magnetX(relX * 0.35);
      magnetY(relY * 0.35);
    });
    magneticBtn.addEventListener('mouseleave', function () {
      magnetX(0);
      magnetY(0);
    });
  }

  // 5. Reveal en masque (clip-path) sur l'image de realisation
  gsap.fromTo('.realisation-preview',
    { clipPath: 'inset(0% 0% 100% 0%)' },
    {
      clipPath: 'inset(0% 0% 0% 0%)',
      duration: 1.2,
      ease: 'power3.inOut',
      scrollTrigger: { trigger: '.realisation-card', start: 'top 70%' },
    }
  );
})();
