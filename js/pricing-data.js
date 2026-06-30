(function (global) {
  'use strict';

  var BASE_PRICE = 390;
  var BASE_LABEL = 'Site vitrine 5 sections, formulaire de contact, design responsive, SEO de base';

  var MODULES = [
    { key: 'admin', label: 'Système admin client (modifier textes/photos seul)', price: 200 },
    { key: 'galerie', label: 'Galerie photos dynamique', price: 80 },
    { key: 'inscription', label: 'Formulaire d\'inscription + génération PDF', price: 150 },
    { key: 'blog', label: 'Blog / actualités', price: 120 },
    { key: 'helloasso', label: 'Paiement en ligne (HelloAsso)', price: 80 },
    { key: 'brevo', label: 'Emailing / CRM (Brevo)', price: 80 },
    { key: 'stripe', label: 'Paiement sécurisé avancé (Stripe)', price: 150 },
    { key: 'seo', label: 'SEO avancé + référencement Google', price: 80 },
  ];

  var FORMULES = [
    {
      key: 'essentiel', name: 'Essentiel', price: 390, modules: [],
      delaiJours: 5,
      desc: 'La base seule — vitrine simple et efficace.',
    },
    {
      key: 'standard', name: 'Standard', price: 590, modules: ['admin', 'galerie'],
      delaiJours: 7,
      desc: 'Base + accès admin + galerie photos.',
      badge: 'Populaire',
    },
    {
      key: 'premium', name: 'Premium', price: 1090, modules: ['admin', 'galerie', 'inscription', 'blog', 'helloasso', 'brevo', 'stripe', 'seo'],
      delaiJours: 10,
      desc: 'Tout inclus — base + les 8 modules à la carte.',
    },
  ];

  var MAINTENANCE = [
    { key: 'aucune', label: 'Aucune pour l\'instant', price: 0 },
    { key: 'basique', label: 'Basique — hébergement, surveillance, 1 modif/mois', price: 25 },
    { key: 'standard', label: 'Standard — + 3 modifs/mois + support email 48h', price: 45 },
    { key: 'premium', label: 'Premium — modifs illimitées + support prioritaire 24h', price: 80 },
  ];

  function moduleByKey(key) {
    for (var i = 0; i < MODULES.length; i++) {
      if (MODULES[i].key === key) return MODULES[i];
    }
    return null;
  }

  function formuleByKey(key) {
    for (var i = 0; i < FORMULES.length; i++) {
      if (FORMULES[i].key === key) return FORMULES[i];
    }
    return null;
  }

  function modulesCost(keys) {
    return keys.reduce(function (sum, k) {
      var m = moduleByKey(k);
      return sum + (m ? m.price : 0);
    }, 0);
  }

  function alaCarteTotal(keys) {
    return BASE_PRICE + modulesCost(keys);
  }

  // Among predefined formules whose modules are fully covered by the selection,
  // prefer the most comprehensive pack (most modules covered). Break ties by savings.
  // This ensures "admin+galerie+inscription+blog+X" suggests Premium, not Standard.
  function bestPackSuggestion(selectedKeys) {
    var totalALaCarte = alaCarteTotal(selectedKeys);
    var best = null;
    FORMULES.forEach(function (f) {
      if (!f.modules.length) return;
      var covers = f.modules.every(function (mk) { return selectedKeys.indexOf(mk) !== -1; });
      if (!covers) return;
      var extraKeys = selectedKeys.filter(function (k) { return f.modules.indexOf(k) === -1; });
      var packTotal = f.price + modulesCost(extraKeys);
      var savings = totalALaCarte - packTotal;
      if (savings > 0) {
        var betterCoverage = !best || f.modules.length > best.formule.modules.length;
        var sameCoverageBetterSavings = best && f.modules.length === best.formule.modules.length && savings > best.savings;
        if (betterCoverage || sameCoverageBetterSavings) {
          best = { formule: f, packTotal: packTotal, savings: savings, extraKeys: extraKeys };
        }
      }
    });
    return best;
  }

  global.AbiWebPricing = {
    BASE_PRICE: BASE_PRICE,
    BASE_LABEL: BASE_LABEL,
    MODULES: MODULES,
    FORMULES: FORMULES,
    MAINTENANCE: MAINTENANCE,
    moduleByKey: moduleByKey,
    formuleByKey: formuleByKey,
    modulesCost: modulesCost,
    alaCarteTotal: alaCarteTotal,
    bestPackSuggestion: bestPackSuggestion,
  };
})(window);
