// Applique /css/index-sections.css une fois telechargee, sans bloquer le
// premier rendu. Le <link media="print"> laisse le navigateur le
// telecharger en parallele sans qu'il compte comme render-blocking ; ce
// script bascule media="all" des que la feuille est prete (ou immediatement
// si elle l'etait deja au moment ou ce script differe s'execute).
(function () {
  var link = document.getElementById('deferredSectionsCss');
  if (!link) return;
  if (link.sheet) {
    link.media = 'all';
  } else {
    link.addEventListener('load', function () { link.media = 'all'; });
  }
})();
