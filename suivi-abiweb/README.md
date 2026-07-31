# Suivi AbiWeb

Page statique (HTML/CSS/JS vanilla, sans backend) affichant l'avancement d'un
projet client à partir de son fichier `status.json` public sur GitHub.

Destinée à être déployée sur **suivi.abiweb.fr**, en tant que projet Vercel
séparé du site principal abiweb.fr.

## Fonctionnement

`?repo=nom-du-repo` → la page va chercher
`https://raw.githubusercontent.com/Abudara25/nom-du-repo/main/status.json`
et affiche client, étape, avancement, message et date de mise à jour.
Voir [`../client-template/README.md`](../client-template/README.md) pour la
structure de `status.json` à copier dans chaque repo client.

## Déployer ce dossier comme son propre projet

Ce dossier est autonome (aucune dépendance, pas de build) : il doit être
poussé dans son **propre repo GitHub**, distinct du repo `abiweb`, pour
devenir son propre projet Vercel. Voir les étapes détaillées données par
Claude en fin de conversation (création du repo, déploiement Vercel, domaine
`suivi.abiweb.fr`, CNAME chez Infomaniak).
