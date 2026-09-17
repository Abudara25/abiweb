// Catalogue unique importe par le navigateur et les fonctions serveur.
export const BASE_PRICE = 590;
export const BASE_LABEL = 'Site vitrine 5 sections, formulaire de contact, design responsive, SEO de base';

export const MODULES = [
  { key: 'admin', label: 'Système admin client (modifier textes/photos seul)', price: 300,
    desc: 'Un espace privé pour modifier vous-même vos textes, photos et tarifs après la livraison, sans dépendre de moi.' },
  { key: 'galerie', label: 'Galerie photos dynamique', price: 80,
    desc: 'Une galerie que vous alimentez vous-même, pour montrer vos réalisations, locaux ou événements.' },
  { key: 'inscription', label: 'Formulaire d\'inscription + génération PDF', price: 150,
    desc: 'Vos visiteurs s\'inscrivent en ligne (adhésion, atelier, événement) et reçoivent une confirmation en PDF.' },
  { key: 'blog', label: 'Blog / actualités', price: 120,
    desc: 'Publiez vous-même des articles ou actualités pour montrer que votre activité est vivante et améliorer votre référencement.' },
  { key: 'helloasso', label: 'Paiement en ligne (ex : HelloAsso, PayPal…)', price: 80,
    desc: 'Vos clients ou adhérents paient directement en ligne, sans rendez-vous ni virement à organiser.' },
  { key: 'brevo', label: 'Emailing / CRM (ex : Brevo…)', price: 80,
    desc: 'Centralisez les contacts récoltés sur votre site et envoyez-leur des emails (newsletter, relances) depuis un seul outil.' },
  { key: 'stripe', label: 'Paiement sécurisé avancé (ex : Stripe…)', price: 150,
    desc: 'Encaissez des paiements par carte bancaire directement sur votre site, de façon sécurisée et automatisée.' },
  { key: 'seo', label: 'SEO avancé + référencement Google', price: 80,
    desc: 'Un travail approfondi sur vos contenus et mots-clés pour mieux apparaître dans les résultats Google.' },
  { key: 'geo', label: 'Visibilité IA (ChatGPT, Perplexity, AI Overviews)', price: 80,
    desc: 'Rend votre site exploitable par les moteurs de réponse IA : fiche llms.txt, données structurées complètes, FAQ rédigée pour être citée, et un rapport de contrôle avant/après. La citation par un moteur IA reste aléatoire, jamais garantie.' },
  { key: 'resa', label: 'Prise de rendez-vous en ligne (ex : Calendly, Doctolib, Planity…)', price: 80,
    desc: 'Vos clients réservent un créneau directement en ligne, sans échange de messages pour trouver une date.' },
];

export const FORMULES = [
  {
    key: 'essentiel', name: 'Essentiel', price: 590, modules: [],
    delaiJours: 5, maxPhotos: 8, videos: false,
    desc: 'La base seule - vitrine simple et efficace.',
  },
  {
    key: 'standard', name: 'Standard', price: 790, modules: ['admin', 'galerie'],
    delaiJours: 7, maxPhotos: 15, videos: true,
    desc: 'Base + accès admin + galerie photos.',
    badge: 'Populaire',
  },
  {
    key: 'premium', name: 'Premium', price: 1290, modules: ['admin', 'galerie', 'inscription', 'blog', 'helloasso', 'brevo', 'stripe', 'seo', 'geo', 'resa'],
    delaiJours: 10, maxPhotos: 20, videos: true,
    desc: 'Tout inclus - base + les 10 modules à la carte.',
  },
];

export const MAINTENANCE = [
  { key: 'aucune', label: 'Aucune pour l\'instant', price: 0 },
  { key: 'basique', label: 'Basique - hébergement, surveillance, 1 modif/mois', price: 25 },
  { key: 'standard', label: 'Standard - + 3 modifs/mois + support email 48h', price: 45 },
  { key: 'premium', label: 'Premium - modifs illimitées + support prioritaire 24h', price: 80 },
];

export function moduleByKey(key) {
  return MODULES.find(module => module.key === key) || null;
}

export function formuleByKey(key) {
  return FORMULES.find(formule => formule.key === key) || null;
}

export function maintenanceByKey(key) {
  return MAINTENANCE.find(maintenance => maintenance.key === key) || null;
}

export function uniqueModuleKeys(keys = []) {
  return [...new Set(keys)].filter(key => moduleByKey(key));
}

export function moduleLabels(keys) {
  return uniqueModuleKeys(keys).map(key => moduleByKey(key).label);
}

export function modulesCost(keys) {
  return uniqueModuleKeys(keys).reduce((sum, key) => sum + moduleByKey(key).price, 0);
}

export function alaCarteTotal(keys) {
  return BASE_PRICE + modulesCost(keys);
}

// Un pack peut inclure des fonctions supplementaires et rester moins cher.
// On compare donc tous les packs, completes des seules options manquantes.
export function bestPackSuggestion(selectedKeys) {
  const selected = uniqueModuleKeys(selectedKeys);
  const total = alaCarteTotal(selected);
  let best = null;
  for (const formule of FORMULES) {
    const extraKeys = selected.filter(key => !formule.modules.includes(key));
    const packTotal = formule.price + modulesCost(extraKeys);
    const savings = total - packTotal;
    if (savings > 0 && (!best || packTotal < best.packTotal)) {
      best = {
        formule, packTotal, savings, extraKeys,
        includedExtraKeys: formule.modules.filter(key => !selected.includes(key)),
      };
    }
  }
  return best;
}

export const PHOTO_OPTIONS = [
  { value: '5', label: "Jusqu’à 5" },
  { value: '8', label: '6 à 8' },
  { value: '15', label: '9 à 15' },
  { value: '20', label: '16 à 20' },
  { value: 'more', label: 'Plus de 20 — devis personnalisé' },
];

export function photoCount(value) {
  const legacy = {
    'Moins de 5': 5,
    'Entre 5 et 10': 10,
    'Entre 10 et 20': 20,
    'Plus de 20 (Premium uniquement)': Infinity,
  };
  if (value === 'more') return Infinity;
  if (Object.hasOwn(legacy, value)) return legacy[value];
  return PHOTO_OPTIONS.some(option => option.value === value) ? Number(value) : 0;
}

export function estimateMediaConstraints({ tarifMode, formule, moduleKeys = [], photosNb, videos, sections = [] }) {
  const selected = uniqueModuleKeys(moduleKeys);
  const pack = tarifMode === 'forfait'
    ? (formuleByKey(formule) || FORMULES[0])
    : [...FORMULES].reverse().find(item => item.modules.every(key => selected.includes(key)));
  const reasons = [];
  const count = photoCount(photosNb);
  const needsVideo = Boolean(videos && videos !== 'non') || sections.includes('Vidéos');
  if (count > pack.maxPhotos) {
    reasons.push(count > 20
      ? 'Plus de 20 photos : volume à chiffrer sur devis personnalisé.'
      : `${count} photos demandées ; ${pack.maxPhotos} photos incluses dans cette sélection.`);
  }
  if (needsVideo && !pack.videos) {
    reasons.push('Intégration vidéo à chiffrer en supplément ; incluse avec Standard et Premium.');
  }
  return {
    estimationStatus: reasons.length ? 'custom' : 'standard',
    estimationReasons: reasons,
  };
}
