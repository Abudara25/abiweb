(function () {
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
