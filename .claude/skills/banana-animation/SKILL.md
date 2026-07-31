---
name: banana-animation
description: Utiliser cette skill quand un besoin de visuel original (illustration, icone, image de scene) est identifie pour animer une section d'un site client, et qu'aucun asset existant ne convient. Ne pas utiliser pour du texte, du contenu standard, ou si des visuels/photos du client sont deja disponibles. Declencheurs : demande explicite d'animation originale, besoin d'un visuel sur-mesure sans stock photo adapte, section hero ou storytelling necessitant un element graphique unique.
---

# Generation de visuels pour animation via Nano Banana

## Quand utiliser cette skill
Uniquement si :
- Un besoin d'animation originale est identifie sur le site en cours
- Aucun visuel existant (photo client, stock, template AbiWeb) ne convient
- L'utilisateur valide qu'on parte sur un visuel genere plutot qu'un asset existant

Ne PAS utiliser pour du contenu texte, des sites standards sans besoin d'animation specifique, ou si des photos du client sont deja fournies.

## Etapes

1. Confirmer avec l'utilisateur le besoin exact (quelle section, quel style, quelle palette) avant de generer quoi que ce soit

2. Utiliser Claude in Chrome pour aller sur Gemini (compte deja connecte) et selectionner le modele Nano Banana

3. Generer les visuels necessaires, coherents en style et palette

4. Telecharger les fichiers dans /public/images du projet en cours, avec des noms clairs

5. Proposer une structure d'animation GSAP utilisant ces visuels (apparition, cascade, scroll trigger selon le contexte)

6. Rester en local, aucun commit/push automatique, attendre validation de l'utilisateur avant toute mise en prod

## Style par defaut AbiWeb
Sobre, professionnel, adapte a une cible TPE/PME. Palette a adapter au client, mais eviter le too flashy sauf demande contraire.
