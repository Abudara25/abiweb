---
name: banana-video
description: Utiliser cette skill quand un besoin de visuel ANIME original (courte video/boucle en arriere-plan, illustration animee) est identifie pour une section d'un site client, et qu'aucun asset existant (image fixe, GSAP sur asset statique) ne suffit. Ne pas utiliser pour du texte, du contenu standard, ou si une image fixe + animation GSAP suffit deja. Declencheurs : demande explicite de video/animation generee sur-mesure, besoin d'un hero video en boucle, section storytelling necessitant un mouvement natif que GSAP ne peut pas simuler sur une image fixe.
---

# Generation de visuels animes (video) via Gemini

## Quand utiliser cette skill
Uniquement si :
- Un besoin de visuel ANIME (pas juste une image fixe animee via GSAP) est identifie sur le site en cours
- Une image fixe + animation GSAP (voir skill banana-animation) ne suffit pas a l'effet recherche
- L'utilisateur valide qu'on parte sur une video generee plutot qu'une image fixe

Ne PAS utiliser si une image fixe convient (privilegier banana-animation + GSAP, plus leger et plus simple a maintenir). Ne PAS utiliser pour du contenu texte ou des sites standards sans besoin d'animation video specifique.

## Contrainte prioritaire : le poids du fichier
Une video, meme courte, pese largement plus qu'une image. Sur un site vitrine cible TPE/associations (visiteurs potentiellement en mobile/4G), une video hero trop lourde degrade le temps de chargement et l'experience. A chaque etape :
- Privilegier une duree courte (quelques secondes en boucle) et une resolution raisonnable (pas de 4K pour un hero de quelques centaines de pixels de large)
- Compresser/reencoder le fichier telecharge avant integration (format .webm ou .mp4 H.264 optimise) si l'outil de generation ne propose pas deja un export leger
- Verifier le poids final du fichier avant integration et le comparer aux autres assets du site (voir skill banana-animation pour un ordre de grandeur : le JS du site pese quelques Ko, une image hero quelques centaines de Ko ; une video hero ne devrait pas exploser ce budget de plusieurs Mo sans raison)
- Proposer `autoplay muted loop playsinline` (pas de son, lecture native navigateur) plutot qu'un lecteur video complet, pour rester discret et leger a l'usage

## Etapes

1. Confirmer avec l'utilisateur le besoin exact (quelle section, quel style, quelle duree/boucle, quelle palette) avant de generer quoi que ce soit

2. Utiliser Claude in Chrome pour aller sur Gemini (compte deja connecte), cliquer sur le "+" a cote du champ de prompt, puis choisir l'option "Creer une video" (sous "Creer une image" / Nano Banana)

3. Generer la video, coherente en style et palette avec le reste du site

4. Telecharger le fichier dans /images (ou un sous-dossier dedie, ex: /images/hero/) du projet en cours, avec un nom clair, et verifier son poids (voir contrainte ci-dessus) avant de l'integrer

5. Proposer une integration HTML/CSS (`<video autoplay muted loop playsinline>`) et une structure d'animation GSAP complementaire si besoin (fade-in au chargement, reveal au scroll), en s'appuyant sur ce qui existe deja pour le hero

6. Rester en local, aucun commit/push automatique, attendre validation de l'utilisateur avant toute mise en prod

## Style par defaut AbiWeb
Sobre, professionnel, adapte a une cible TPE/PME. Palette a adapter au client, mais eviter le too flashy sauf demande contraire. Voir aussi la skill banana-animation pour le contexte general et le style par defaut.
