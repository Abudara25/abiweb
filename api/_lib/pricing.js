// Miroir serveur de /js/pricing-data.js. Le site n'a pas de bundler partagé entre le
// front statique et les fonctions serverless : garder ces deux fichiers synchronisés
// si les modules ou les prix changent.

export const BASE_PRICE = 490;

export const MODULES = [
  { key: 'admin', label: "Système admin client (modifier textes/photos seul)", price: 200 },
  { key: 'galerie', label: 'Galerie photos dynamique', price: 80 },
  { key: 'inscription', label: "Formulaire d'inscription + génération PDF", price: 150 },
  { key: 'blog', label: 'Blog / actualités', price: 120 },
  { key: 'helloasso', label: 'Paiement en ligne (ex : HelloAsso, PayPal…)', price: 80 },
  { key: 'brevo', label: 'Emailing / CRM (ex : Brevo…)', price: 80 },
  { key: 'stripe', label: 'Paiement sécurisé avancé (ex : Stripe…)', price: 150 },
  { key: 'seo', label: 'SEO avancé + référencement Google', price: 80 },
  { key: 'resa', label: 'Prise de rendez-vous en ligne (ex : Calendly, Doctolib, Planity…)', price: 80 },
];

export function moduleByKey(key) {
  return MODULES.find((m) => m.key === key) || null;
}

export function alaCarteTotal(keys) {
  return keys.reduce((sum, key) => {
    const m = moduleByKey(key);
    return sum + (m ? m.price : 0);
  }, BASE_PRICE);
}

export function moduleLabels(keys) {
  return keys.map((key) => moduleByKey(key)?.label || key);
}
