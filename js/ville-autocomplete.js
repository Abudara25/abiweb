// Autocompletion de ville sur le champ #contact-ville du formulaire de devis,
// via la bibliotheque Places de l'API Google Maps JavaScript.
//
// Charge le script Google seulement au focus du champ, pas au premier rendu :
// c'est un script tiers (maps.googleapis.com) qui ne sert qu'a cette
// interaction precise, inutile de payer son poids et sa connexion tierce
// avant que le visiteur ne clique reellement dans le champ Ville.
(function () {
  var input = document.getElementById('contact-ville');
  if (!input) return;

  // Cle Maps JavaScript API - cle publique par conception (embarquee cote
  // client), sa seule protection est la restriction par referrer HTTP a
  // www.abiweb.fr configuree dans Google Cloud Console.
  var API_KEY = 'AIzaSyD8BFKOiy-SNbLOPofm6sLWcNehtkp6-ZQ';

  var loaded = false;
  function loadPlaces() {
    if (loaded) return;
    loaded = true;

    window.__initVilleAutocomplete = function () {
      var autocomplete = new google.maps.places.Autocomplete(input, {
        fields: ['name'],
        types: ['(cities)'],
        componentRestrictions: { country: 'fr' },
      });
      autocomplete.addListener('place_changed', function () {
        var place = autocomplete.getPlace();
        if (place && place.name) input.value = place.name;
      });
    };

    var script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' + API_KEY +
      '&libraries=places&callback=__initVilleAutocomplete&loading=async';
    script.async = true;
    document.head.appendChild(script);
  }

  input.addEventListener('focus', loadPlaces, { once: true });
})();
