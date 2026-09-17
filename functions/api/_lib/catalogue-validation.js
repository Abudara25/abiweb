import { FORMULES, MAINTENANCE } from './pricing.js';

export const formuleLabel = (formule) => `${formule.name} - ${formule.price}€`;

export function resolveFormule(value) {
  return FORMULES.find((item) => value === item.key || value === formuleLabel(item)) || null;
}

export function resolveContactFormule(value) {
  const formule = resolveFormule(value);
  if (formule) return formuleLabel(formule);
  const other = {
    '': '', alacarte: 'Sur-mesure à la carte', indecis: 'Je ne sais pas encore',
    'Sur-mesure à la carte': 'Sur-mesure à la carte', 'Je ne sais pas encore': 'Je ne sais pas encore',
  };
  return Object.hasOwn(other, value) ? other[value] : null;
}

export function maintenanceLabel(item) {
  if (!item.price) return item.label;
  const name = item.key.charAt(0).toUpperCase() + item.key.slice(1);
  return `${name} - ${item.price}€/mois`;
}

export function resolveMaintenance(value) {
  return MAINTENANCE.find((item) => value === item.key || value === maintenanceLabel(item)) || null;
}
