// Limites partagées entre les formulaires et leurs routes API.
export const CONTACT_LIMITS = Object.freeze({
  nom: 100, email: 254, tel: 30, formule: 60, message: 5000,
});

export const BRIEF_LIMITS = Object.freeze({
  nom: 120, type: 60, contact: 100, email: 254, tel: 30, ville: 100,
  activite: 1000, siteUrl: 300, formule: 60, tarifMode: 20, maintenance: 80,
  domaine: 20, domaineNom: 120, photos: 40, photosNb: 40, videos: 20,
  logo: 40, textes: 80, fbLink: 300, igLink: 300, ytLink: 300, autreLink: 300,
  style: 60, couleur1: 30, couleur2: 30, couleursTexte: 300,
  refs: 500, refNon: 300, infos: 3000,
});
