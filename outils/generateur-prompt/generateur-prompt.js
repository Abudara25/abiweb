#!/usr/bin/env node
/**
 * Générateur de prompt Claude Code - AbiWeb
 *
 * Usage : node generateur-prompt.js brief_client.json
 *
 * Lit un brief client (JSON) et génère automatiquement un prompt
 * complet pour Claude Code, en combinant :
 *  - les règles générales AbiWeb
 *  - un template spécifique au secteur du client
 *  - les infos propres au client (nom, couleurs, formule, sections)
 *
 * Le résultat est écrit dans prompt_final.md, prêt à être collé
 * ou lu directement par Claude Code.
 */

const fs = require('fs');
const path = require('path');

// ---- 1. Templates par secteur ------------------------------------------
// Sections vérifiées le 2026-07-06 contre le repo Abudara25/abiweb-templates
// (ancres <section id="..."> et navigation des index.html).
// Rappel : les formules valides sont "essentiel" | "standard" | "premium"
// (minuscules, cf. window.FORMULE dans site-content.js).

const TEMPLATES = {
  association: {
    // Template : association/abiweb-template-association
    // Variante disponible : abiweb-template-association-caritative
    // (missions, bureau, actualités, don, contact)
    sections: [
      'Accueil (hero)',
      'Activités (#activites)',
      'Agenda (#agenda, Standard et Premium)',
      'Tarifs (#tarifs)',
      'Contact (#contact)',
      'Galerie (#galerie, Premium uniquement)',
      'Documents (#documents, Premium uniquement)'
    ],
    ton: "chaleureux, orienté communauté et engagement",
    specifique: "Tout le contenu vit dans site-content.js (clés : club, contact, stats, sections, agenda, tarifs, lienAdhesion, galerie, documents, palmares, seo, mentionsLegales), jamais en dur dans index.html. Prévoir le lien d'adhésion (lienAdhesion) et un agenda facile à mettre à jour."
  },
  restaurant: {
    // Template : restaurant/abiweb-template-restaurant
    sections: [
      'Accueil (hero)',
      'La carte (#carte)',
      'Menus (#menus)',
      'Réservation (#reservation, Standard et Premium)',
      'Infos pratiques / Contact (#contact)',
      'Galerie (#galerie, Premium uniquement)',
      'Documents (#documents, Premium uniquement)'
    ],
    ton: "appétissant, convivial, mise en avant visuelle des plats",
    specifique: "Tout le contenu vit dans site-content.js (clés : restaurant, contact, stats, categories, menus, lienReservation, galerie, documents, seo, mentionsLegales), jamais en dur dans index.html. La carte est modifiable via categories/menus et la réservation passe par lienReservation (téléphone, LaFourchette, Calendly...)."
  },
  // NOTE (2026-07-06) : aucun template "artisan" n'existe encore dans
  // abiweb-templates. Sections indicatives, à aligner sur le vrai template
  // le jour où il sera créé.
  artisan: {
    sections: ['Accueil', 'Services', 'Réalisations', 'Devis', 'Contact'],
    ton: "professionnel, rassurant, orienté confiance et savoir-faire",
    specifique: "Prévoir une galerie de réalisations et un formulaire de demande de devis connecté à Brevo."
  }
};

// ---- 2. Règles générales AbiWeb ----

const REGLES_GENERALES = `
Stack : HTML/CSS/JS vanilla, sans build ni framework (moteur partagé site-engine.js, contenu dans site-content.js), déploiement Vercel, DNS/domaine via Infomaniak, emailing via Brevo.
Respecte la structure de dossiers habituelle du repo Abudara25/abiweb-templates.
Utilise le système de tiers window.FORMULE pour activer/désactiver les modules selon la formule choisie.
Code propre, composants réutilisables, pas de dépendances inutiles.
Aucune IA ou fonctionnalité liée à l'IA ne doit être intégrée au site livré au client : l'IA est un outil de production interne uniquement.
`.trim();

// ---- 3. Génération du prompt --------------------------------------------

function genererPrompt(brief) {
  const template = TEMPLATES[brief.secteur];
  if (!template) {
    throw new Error(
      `Secteur inconnu : "${brief.secteur}". Secteurs disponibles : ${Object.keys(TEMPLATES).join(', ')}`
    );
  }

  const sections = brief.sections_personnalisees && brief.sections_personnalisees.length
    ? brief.sections_personnalisees
    : template.sections;

  return `
# Prompt généré automatiquement - AbiWeb

## Contexte général
${REGLES_GENERALES}

## Client
- Nom : ${brief.nom_client}
- Secteur : ${brief.secteur}
- Formule : ${brief.formule}
- Couleurs principales : ${brief.couleurs || 'à définir avec le client'}
- Ton souhaité : ${template.ton}

## Sections du site
${sections.map(s => `- ${s}`).join('\n')}

## Spécificités du secteur
${template.specifique}

## Consignes complémentaires du client
${brief.consignes_specifiques || 'Aucune consigne particulière.'}

## Tâche
Crée le site pour ce client en respectant strictement la structure et les conventions du template "${brief.secteur}" du repo abiweb-templates. Active uniquement les modules correspondant à la formule "${brief.formule}".
`.trim();
}

// ---- 4. Exécution en ligne de commande -----------------------------------

const briefPath = process.argv[2];
if (!briefPath) {
  console.error('Usage : node generateur-prompt.js brief_client.json');
  process.exit(1);
}

const brief = JSON.parse(fs.readFileSync(path.resolve(briefPath), 'utf8'));
const prompt = genererPrompt(brief);

const outputPath = path.join(path.dirname(path.resolve(briefPath)), 'prompt_final.md');
fs.writeFileSync(outputPath, prompt, 'utf8');

console.log(`Prompt généré : ${outputPath}`);
