// Mode de consentement basique : aucun script tiers avant l'accord.
(function () {
  var measurementId = 'G-S2QVJFM4L5';
  var loaded = false;
  var currentConsent = null;
  try { currentConsent = localStorage.getItem('abiweb-consent'); } catch { /* Stockage prive indisponible. */ }

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  window['ga-disable-' + measurementId] = true;
  gtag('consent', 'default', {
    analytics_storage: 'denied', ad_storage: 'denied',
    ad_user_data: 'denied', ad_personalization: 'denied',
  });

  function clearAnalyticsCookies() {
    var names = document.cookie.split(';').map(function (cookie) { return cookie.trim().split('=')[0]; });
    var hostname = window.location.hostname;
    var domains = ['', hostname];
    if (hostname === 'abiweb.fr' || hostname.endsWith('.abiweb.fr')) domains.push('abiweb.fr');
    names.filter(function (name) { return /^(?:_ga(?:_|$)|_gid$|_gat(?:_|$)|_gcl_)/.test(name); }).forEach(function (name) {
      domains.forEach(function (domain) {
        document.cookie = name + '=; Max-Age=0; Path=/; SameSite=Lax' + (domain ? '; Domain=' + domain : '');
      });
    });
  }

  function loadAnalytics() {
    window['ga-disable-' + measurementId] = false;
    gtag('consent', 'update', { analytics_storage: 'granted' });
    if (loaded) return;
    loaded = true;
    var tagManager = document.createElement('script');
    tagManager.async = true;
    tagManager.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-N439P2KJ';
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    document.head.appendChild(tagManager);
    var analytics = document.createElement('script');
    analytics.async = true;
    analytics.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    document.head.appendChild(analytics);
    gtag('js', new Date());
    gtag('config', measurementId, { allow_google_signals: false, allow_ad_personalization_signals: false });
  }

  function setConsent(value) {
    var wasLoaded = loaded;
    currentConsent = value === 'granted' ? 'granted' : 'denied';
    var persisted = false;
    try { localStorage.setItem('abiweb-consent', currentConsent); persisted = true; } catch { /* Garder le choix en memoire. */ }
    if (currentConsent === 'granted') {
      loadAnalytics();
    } else {
      window['ga-disable-' + measurementId] = true;
      gtag('consent', 'update', {
        analytics_storage: 'denied', ad_storage: 'denied',
        ad_user_data: 'denied', ad_personalization: 'denied',
      });
      clearAnalyticsCookies();
      // Le rechargement detruit aussi les tags et listeners deja executes par GTM.
      // Ne recharger que si le refus est memorise pour eviter de relire un ancien accord.
      if (wasLoaded && persisted) window.location.reload();
    }
  }

  window.abiwebConsent = { get: function () { return currentConsent; }, set: setConsent };
  // Compatibilite avec les pages deja ouvertes qui avaient l'ancien bandeau.
  window.abiwebLoadAnalytics = function () { setConsent('granted'); };
  if (currentConsent === 'granted') loadAnalytics();
  window.addEventListener('storage', function (event) {
    if (event.key === 'abiweb-consent' && event.newValue !== currentConsent) setConsent(event.newValue);
  });
})();
