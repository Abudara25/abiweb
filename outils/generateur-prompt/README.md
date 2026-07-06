# Générateur de prompt Claude Code - AbiWeb

Génère un prompt complet pour Claude Code à partir d'un brief client (JSON), en combinant les règles générales AbiWeb, le template du secteur et les infos du client.

## Utilisation

```
node generateur-prompt.js brief_client.json
```

Le prompt est écrit dans `prompt_final.md`, dans le même dossier que le brief. Un exemple de brief est fourni : `exemple-brief-client.json`.

## Format du brief

| Champ | Description |
|---|---|
| `nom_client` | Nom du client |
| `secteur` | `association`, `restaurant` ou `artisan` |
| `formule` | Formule vendue. Pour `window.FORMULE`, les valeurs valides sont `essentiel`, `standard`, `premium` (en minuscules) |
| `couleurs` | Couleurs principales (optionnel) |
| `sections_personnalisees` | Liste de sections pour remplacer celles du template (laisser `[]` pour les sections par défaut) |
| `consignes_specifiques` | Consignes libres du client (optionnel) |

## Notes

- Les sections `association` et `restaurant` ont été vérifiées le 2026-07-06 contre le repo `Abudara25/abiweb-templates` (ancres et navigation des templates réels).
- Le secteur `artisan` est indicatif : aucun template artisan n'existe encore dans abiweb-templates.
