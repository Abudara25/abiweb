# Suivi des projets clients

Ce dossier fournit un modèle à installer dans chaque dépôt client. Rien ne
s'exécute dans le dépôt AbiWeb : le workflow devient actif uniquement après sa
copie dans `.github/workflows/` du dépôt client.

## Données publiques

Le suivi est public et sans authentification. Le paramètre `?repo=...` identifie
un dépôt ; ce n'est pas un mot de passe. Le nom du client, l'étape et le message
de `status.json` peuvent être lus directement sur GitHub, même si la page est
marquée `noindex`.

Cette version nécessite un dépôt public. Tous les fichiers de ce dépôt, y
compris le code client et les anciennes versions Git, sont alors publics.
Obtenir l'accord du client et ne publier que des informations destinées à être
publiques : aucun secret, document privé ou détail de paiement. Pour un projet
confidentiel, conserver son dépôt privé et prévoir un stockage/API de suivi
avec contrôle d'accès ; ne pas rendre le dépôt public pour contourner un 404.

## Installer dans un nouveau dépôt

Le dépôt client doit avoir une branche `main`.

1. Copier `status.json` à la racine de `main`. Renseigner le nom public du
   client, l'étape réelle, le message et la date du jour (`AAAA-MM-JJ`).
   Utiliser `paiement_recu` seulement après encaissement de l'acompte.
2. Copier `update-status.mjs` vers `.github/scripts/update-status.mjs`.
3. Copier `update-status.yml` vers `.github/workflows/update-status.yml`.
4. Committer ces trois fichiers sur `main` avant les premiers pushes de travail.
5. Vérifier que GitHub Actions est autorisé et que les règles de branche
   permettent au workflow de créer et mettre à jour `project-status`. Il
   demande uniquement la permission GitHub `contents: write`.
6. Dans **Actions → Update project status → Run workflow**, sélectionner
   `main` et l'étape initiale réelle pour publier le premier état.

Le workflow crée `project-status` comme branche de données, avec seulement
`status.json` suivi par Git. Configurer l'hébergeur pour déployer `main`
(et éventuellement `preview`), en excluant `project-status` des déploiements.
Cette branche ne contient pas de site web.

Le workflow lit toujours le dernier état de `project-status`, puis écrit sur
cette même branche. Il utilise le script présent sur `main`, quelle que soit
la branche de développement à l'origine de l'événement. Au premier lancement,
il initialise l'état depuis `main/status.json`. Un fichier invalide arrête la
publication au lieu d'écraser les données.

## Étapes et déclenchement

| Étape | Avancement indicatif | Déclenchement |
|---|---:|---|
| paiement_recu | 5 % | Action manuelle après encaissement |
| developpement | 30 % | Push sur une branche de travail |
| preview | 75 % | Push sur `preview`, ou action manuelle |
| corrections | 85 % | Action manuelle |
| mise_en_ligne | 100 % | Action manuelle après vérification du déploiement |
| garantie_retouches | 100 % | Action manuelle au début de la période de retouches |

Un push sur `main` ne signifie pas que le site est accessible : il ne déclare
donc jamais la mise en ligne. Pour `mise_en_ligne` et `garantie_retouches`,
l'action manuelle exige de cocher la confirmation du déploiement réussi et de
l'accès au domaine. Vérifier également les conditions commerciales convenues.

Un push sur `preview` indique la phase de prévisualisation ; il ne garantit
pas la réussite d'un déploiement de démonstration. Vérifier celui-ci avant
d'envoyer son lien au client. Si la branche porte un autre nom, adapter
`refs/heads/preview` dans le script.

Les écritures du workflow sont sérialisées et les transitions ne reculent ni
l'étape ni le pourcentage. Une nouvelle poussée de développement ne remplace
pas `corrections` ; `mise_en_ligne` ne remplace pas `garantie_retouches`,
même si les deux valent 100 %. Une transition ignorée conserve la date du
dernier changement réel. Aucun push forcé n'est utilisé.

## Mise à jour manuelle

Utiliser **Run workflow** sur `main`, choisir l'étape réelle et saisir au besoin
un message public. Le message peut être changé sans avancer l'étape.

Pour corriger une erreur de données ou un pourcentage précis, éditer
`project-status/status.json` directement. Dès que cette branche existe,
modifier le fichier de `main` n'a plus d'effet sur le suivi. Ne pas éditer
pendant une publication Actions en cours ; en cas de conflit, le push échoue
sans écraser la modification et le workflow peut être relancé.

```json
{
  "client": "Nom public du client",
  "etape": "corrections",
  "avancement": 85,
  "derniere_maj": "2026-09-16",
  "message": "Vos retours sont en cours d’intégration."
}
```

## Migrer les dépôts clients existants

Les copies déjà installées ne sont pas mises à jour par une modification de ce
modèle. Pour chaque dépôt client :

1. Désactiver ou remplacer l'ancien workflow pour éviter plusieurs producteurs.
2. Vérifier l'état réel de `main/status.json`. L'ancien workflow pouvait avoir
   laissé un état plus récent uniquement dans une branche de travail :
   reporter cet état dans `main/status.json` avant l'initialisation.
3. Installer le nouveau workflow **et** son script sur `main`.
4. Exclure `project-status` des déploiements de l'hébergeur.
5. Lancer l'action manuelle avec l'état réel et vérifier le contenu publié dans
   `project-status/status.json`, puis la page de suivi.

Le lien client reste inchangé :

```
https://suivi.abiweb.fr/?repo=nom-exact-du-repo-github
```

La page cherche d'abord
`https://raw.githubusercontent.com/Abudara25/nom-exact-du-repo-github/project-status/status.json`.
Elle se replie sur `main/status.json` uniquement si le premier fichier répond
404, pour permettre la migration progressive. Une erreur réseau ou un JSON
invalide affiche une erreur au lieu de présenter silencieusement un ancien état.
