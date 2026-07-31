# Template de suivi client (status.json)

Ce dossier est un modele de reference. Il ne fait rien tout seul : il sert a
etre copie dans chaque nouveau repo client au demarrage d'un projet, pour que
la page suivi.abiweb.fr puisse afficher son avancement.

## 1. Copier le template dans un nouveau repo client

A la creation du repo client :

1. Copier `status.json` a la racine du nouveau repo.
2. Ouvrir `status.json` et remplacer `"client": "Nom du client"` par le vrai
   nom, et regler `"etape"`, `"avancement"`, `"message"` sur l'etape de
   depart (generalement `paiement_recu`, avancement `5`).
3. Copier `update-status.yml` dans le nouveau repo a l'emplacement
   `.github/workflows/update-status.yml` (le renommer si besoin, l'important
   est qu'il soit bien dans `.github/workflows/`).
4. Commit + push. Des le premier push sur une branche de developpement, le
   workflow met a jour `status.json` automatiquement.

Important : dans le repo `abiweb` (ce repo-ci), ce fichier `update-status.yml`
reste dans `client-template/` et n'est PAS dans `.github/workflows/` — il ne
s'execute donc jamais ici. Il ne doit etre place dans `.github/workflows/`
que dans les repos clients.

## 2. Etapes et automatisation

| etape | avancement | declencheur | automatise ? |
|---|---|---|---|
| paiement_recu | 5 | acompte 30% encaisse, projet initialise | non — manuel |
| developpement | 30-60 | premier commit / travail en cours | oui — push sur toute branche hors `main`/`preview` |
| preview | 75 | merge sur la branche `preview`, lien de demo envoye | oui — push sur `preview` |
| corrections | 85 | retours client integres apres preview | non — manuel |
| mise_en_ligne | 100 | merge sur `main`, domaine connecte, solde encaisse | oui — push sur `main` |
| garantie_retouches | 100 | dans les 7 jours suivant la mise en ligne | non — manuel |

Le workflow ne fait jamais reculer l'avancement (une etape automatisee ne
peut pas ecraser une etape manuelle plus avancee, ex: `corrections` a 85 qui
resterait a 85 meme si on repousse sur une branche de dev).

## 3. Mettre a jour manuellement les etapes non automatisees

Pour `paiement_recu`, `corrections` et `garantie_retouches`, editer
directement `status.json` a la racine du repo client sur GitHub (bouton
crayon) ou en local puis `git push`, en respectant la structure :

```json
{
  "client": "Nom du client",
  "etape": "corrections",
  "avancement": 85,
  "derniere_maj": "2026-08-05",
  "message": "Vos retours sont en cours d'integration"
}
```

Messages types par etape :

- `paiement_recu` -> "Votre projet a demarre, developpement en cours de lancement"
- `corrections` -> "Vos retours sont en cours d'integration"
- `garantie_retouches` -> "Periode de retouches offertes en cours (7 jours)"

Toujours mettre `derniere_maj` a la date du jour (format `AAAA-MM-JJ`).

## 4. Construire le lien de suivi a envoyer au client

Le lien a pour forme :

```
https://suivi.abiweb.fr/?repo=nom-exact-du-repo-github
```

`nom-exact-du-repo-github` est le nom du repo tel qu'il apparait dans son URL
GitHub (`github.com/Abudara25/nom-exact-du-repo-github`), sensible a la
casse. La page va chercher
`https://raw.githubusercontent.com/Abudara25/nom-exact-du-repo-github/main/status.json`
— le repo doit donc etre public et avoir `status.json` a la racine de la
branche `main`.
