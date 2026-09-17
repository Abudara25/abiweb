# Suivi AbiWeb

Page autonome en HTML/CSS/JavaScript, sans dépendance ni build. Elle affiche le
client, l'étape, le pourcentage, un message et la dernière date de mise à jour.
L'étape actuelle et l'avancement sont accessibles aux lecteurs d'écran.

## Source du suivi

Le lien client garde la forme :

```
https://suivi.abiweb.fr/?repo=nom-du-repo
```

La page lit `status.json` sur la branche `project-status` du dépôt public
`Abudara25/nom-du-repo`. Un 404 déclenche une lecture de `main/status.json`
pour les anciens dépôts. Aucun repli n'est effectué sur une panne ou un JSON
invalide, pour éviter d'afficher un état périmé. Le chargement est limité à
10 secondes, y compris la lecture du JSON.

Voir [le modèle client](../client-template/README.md) pour l'installation, la
migration des dépôts existants et les étapes manuelles. Le workflow client et
son script doivent être installés ensemble.

Le nom du dépôt est un identifiant public, pas un secret d'accès. La page
`noindex` n'est pas un espace confidentiel : les données et le dépôt source
restent publics. Ne jamais y publier de données privées. Les projets qui
nécessitent un suivi confidentiel demandent un stockage protégé distinct.

## Déploiement sur suivi.abiweb.fr

1. Créer un projet Vercel à partir du dépôt et choisir `suivi-abiweb` comme
   répertoire racine. Autre possibilité : copier les fichiers de ce dossier
   dans un dépôt dédié et sélectionner sa racine.
2. Choisir un projet statique sans commande de build. Publier `index.html`,
   `style.css`, `script.js` et conserver `vercel.json` pour les en-têtes.
3. Associer `suivi.abiweb.fr` au projet et appliquer chez le gestionnaire DNS
   les enregistrements affichés par l'hébergeur.
4. Vérifier le certificat HTTPS, la politique CSP autorisant la lecture de
   `raw.githubusercontent.com`, puis un lien de dépôt client réel.
5. Vérifier également un lien incomplet et un dépôt inexistant : l'erreur doit
   être lisible et le lien de contact disponible.

Pour changer de compte GitHub, modifier `GITHUB_USER` dans `script.js`.
La page de suivi est un projet séparé du site principal ; son déploiement
n'installe pas automatiquement le workflow dans les dépôts clients.
