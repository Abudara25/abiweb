# abiweb.fr

Site vitrine d'AbiWeb, service de création de sites internet clé en main pour
associations, TPE, commerçants et auto-entrepreneurs.

Production : <https://www.abiweb.fr>

## Architecture

Site statique sans étape de build (pas de framework, pas de bundler), déployé
sur **Cloudflare Workers** (Workers Builds, git-connecté à `master`). Ouvrir
un fichier HTML dans un navigateur suffit à voir la page, aux appels `/api/*`
près.

```
index.html                       accueil : tarifs, simulateur, démos, formulaire
devis/                           formulaire de brief en 5 étapes
cgv/  mentions-legales/  politique-de-confidentialite/
demos/<secteur>/                 6 maquettes fictives, affichées en iframe
                                 sur l'accueil, toutes en noindex
404.html                         page d'erreur
suivi-abiweb/                    suivi.abiweb.fr : avancement des projets clients
                                 (reecrit par _worker.js, meme Worker)

css/shared.css                   @font-face, design tokens, footer, bandeau
                                 cookies, accessibilité. Chargé par toutes les pages
css/index-sections.css           sections de l'accueil sous la ligne de flottaison
fonts/                           polices auto-hébergées (voir plus bas)
js/pricing-data.js               source de vérité des tarifs côté client
js/home.js  js/devis.js          logique des formulaires
js/turnstile-lazy.js             charge le widget anti-spam a l'approche du formulaire
js/analytics-loader.js  js/cookie-banner.js

_worker.js                       routeur du Worker : branche /api/* sur functions/api/*,
                                 sinon sert les assets statiques (voir plus bas)
functions/api/send-contact.js    formulaire de contact rapide
functions/api/send-brief.js      brief détaillé depuis /devis
functions/api/notify-pr.js       notification email des PR automatiques
functions/api/_lib/email-utils.js  envoi Brevo, échappement HTML, upsert contact
functions/api/_lib/pricing.js    miroir serveur des tarifs
functions/api/_lib/rate-limit.js plafonnement des envois
functions/api/_lib/turnstile.js  verification serveur du widget anti-spam

wrangler.jsonc                   config du Worker (assets, vars non-secretes)
_headers                         en-têtes de sécurité, cache (equivalent Cloudflare de vercel.json)
_redirects                       redirections
```

Les styles propres à une page restent dans son `<style>` : les thèmes de
l'accueil (sombre) et de `/devis` (clair) divergent trop pour être mutualisés.
Seul ce qui est strictement identique partout vit dans `css/shared.css`.

Les routes `/api/*` sont des Cloudflare Pages Functions en ESM
(`export async function onRequestPost({ request, env })`), routées
manuellement dans `_worker.js` (nécessaire car `assets.run_worker_first: true`
dans `wrangler.jsonc` fait passer toutes les requêtes par le Worker avant les
assets statiques).

**Pas de gabarit ni de composant partagé pour le HTML** : nav, footer et
boilerplate SEO sont dupliqués dans chacune des ~12 pages. Une modification
qui doit s'appliquer partout (ex. le bandeau cookies) se fait à la main,
fichier par fichier - c'est une dette connue, pas un oubli.

**Ancien code Vercel** (`api/*.js`, format `req/res`) supprimé le
2026-09-03 : il datait d'avant la migration vers Cloudflare, n'était plus
utilisé, n'était pas linté, et n'implémentait même plus la vérification
Turnstile. Si besoin de le consulter, il reste dans l'historique git.

## Variables d'environnement

Deux mécanismes différents selon la nature de la variable (voir aussi
`wrangler.jsonc`) :

- **Secrets** (clés API, tokens) : dashboard Cloudflare → Workers → `abiweb`
  → Settings → Variables et secrets, ou `wrangler secret put NOM`. Ne
  survivent aux redéploiements que s'ils sont chiffrés ("Encrypt").
- **Variables non-secrètes** : déclarées dans le bloc `"vars"` de
  `wrangler.jsonc`, committé donc reconstruit à chaque déploiement.
  **Piège vécu** : une variable texte brut ajoutée seulement via le
  dashboard peut disparaître après un déploiement git - toujours passer par
  `wrangler.jsonc` pour le non-secret.

| Variable | Type | Utilisée par | Rôle |
|---|---|---|---|
| `BREVO_API_KEY` | secret | `_lib/email-utils.js` | Envoi des emails et création des contacts via l'API Brevo |
| `SUPABASE_URL` | secret | `send-brief.js` | Insertion de chaque brief dans la table `briefs` |
| `SUPABASE_ANON_KEY` | secret | `send-brief.js` | Idem |
| `NOTIFY_SECRET` | secret | `notify-pr.js` | Secret partagé protégeant la route de notification |
| `TURNSTILE_SECRET` | secret | `_lib/turnstile.js` | Vérification serveur du widget anti-spam |
| `TURNSTILE_HOSTNAMES` | var (wrangler.jsonc) | `_lib/turnstile.js` | Hôtes autorisés pour la vérification Turnstile |

L'insertion Supabase est non bloquante : un échec n'empêche pas l'envoi de
l'email. Si `SUPABASE_URL` ou `SUPABASE_ANON_KEY` est absente, l'insertion est
simplement ignorée.

## Services externes

- **Hébergement** : Cloudflare Workers (Static Assets), zone `abiweb.fr`,
  Worker `abiweb`, déploiement automatique sur push vers `master` (Workers
  Builds). Domaine enregistré chez Infomaniak, nameservers pointés vers
  Cloudflare.
- **Email transactionnel** : Brevo. Expéditeur vérifié `AbiWeb <contact@abiweb.fr>`,
  domaine authentifié DKIM/DMARC. Chaque soumission crée aussi un contact dans
  la liste Brevo `2`. L'attribut `SMS` attend un format international
  (`33XXXXXXXXX`), la normalisation est faite par `normalizeFrenchPhone`.
- **Anti-spam formulaires** : Cloudflare Turnstile, vérifié côté serveur
  (`action` + `hostname` contrôlés, pas seulement la présence du token).
  Le widget se charge en différé (`js/turnstile-lazy.js`) plutôt qu'au premier
  rendu, pour ne pas pénaliser le LCP mobile - voir la section Performance.
- **Mesure d'audience** : Google Tag Manager et Google Analytics, chargés
  uniquement après acceptation du bandeau cookies (clé `abiweb-consent` dans
  `localStorage`). Cloudflare Web Analytics (RUM) a été désactivé le
  2026-09-03 (redondant avec GA, et son beacon tiers pesait sur le LCP mobile).

## Polices

Poppins et Inter sont auto-hébergées dans `fonts/` (licence SIL Open Font
License 1.1) plutôt que chargées depuis `fonts.gstatic.com`. Cela supprime deux
connexions tierces et évite de transmettre l'IP de chaque visiteur à Google
avant tout consentement. La CSP le verrouille : `font-src 'self'`.

Inter est un fichier variable unique couvrant les graisses 400 à 600 ; Poppins
a un fichier par graisse (400, 500, 600, 700, 800). Chaque page précharge
`inter-var.woff2` et `poppins-800.woff2`.

Pour changer une graisse : ajouter le `.woff2` dans `fonts/`, déclarer le
`@font-face` correspondant dans `css/shared.css`. Ne pas réintroduire de `<link>`
vers Google Fonts, la CSP le bloquerait.

**Piège CLS** : tout élément dont le texte utilise une police web (`Inter`,
`Poppins`) et dont la hauteur peut varier selon le nombre de lignes doit être
vérifié à la largeur mobile réelle (~360px), pas seulement en desktop - un
swap de police peut changer le nombre de lignes et décaler la mise en page
après le premier rendu. Deux CLS distincts causés par ce mécanisme ont été
corrigés le 2026-09-03 (bandeau cookies, puis widget Turnstile).

## Sécurité

- En-têtes définis dans `_headers` : CSP, HSTS, `X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
  L'accueil autorise `frame-src 'self'` (iframe des démos) et `/demos/*`
  autorise `frame-ancestors 'self'` ; tout le reste est verrouillé.
- Les deux formulaires valident côté serveur (champs requis, regex email,
  plafonds de longueur), utilisent un honeypot (`website`) et un délai minimum
  de remplissage, échappent toute donnée client insérée dans le HTML des
  emails, et vérifient un token Turnstile côté serveur (action + hostname
  contrôlés).
- `functions/api/_lib/rate-limit.js` plafonne à 5 envois par IP sur 10
  minutes (+ un plafond global de 60/instance). Le stockage est en mémoire,
  donc par instance de fonction : cela arrête un attaquant isolé, pas une
  attaque distribuée. Pour un plafond strict, il faudrait passer par
  Cloudflare KV ou Supabase.

## Tests

```sh
npm test           # node --test, couvre les fonctions critiques cote serveur
```

Couverture actuelle : échappement HTML (`esc`/`escMultiline`), validation
email, normalisation téléphone, résolution d'IP client, plafonnement de
débit, et les rejets rapides de la vérification Turnstile (token absent/trop
long/hôtes non configurés). Pas de mock du réseau : le succès réel de
`siteverify` et l'envoi Brevo restent vérifiés manuellement avant chaque
déploiement sensible. La CI (`npm test`) tourne sur chaque push/PR.

## Développement

```sh
npm install        # eslint, wrangler
npm run lint       # doit sortir sans erreur ni warning
npm test           # tests unitaires (fonctions pures, pas de reseau)
npm run dev        # wrangler dev, necessaire pour tester les routes /api/*
```

Sans `wrangler dev`, un simple serveur statique suffit pour travailler sur le
HTML/CSS, mais les formulaires échoueront faute de routes `/api/*` et les
secrets (`BREVO_API_KEY`, etc.) ne seront pas disponibles - `wrangler dev`
les lit depuis `.dev.vars` (non committé) ou le dashboard.

La CI GitHub Actions exécute `npm run lint` puis `npm test` sur chaque push
et chaque PR.

## Cache

`_headers` fixe des durées distinctes selon le type de fichier. Les noms de
fichiers ne sont pas hashés : ne pas mettre `immutable` sur `/js/*` ou `/css/*`
sans mettre en place un système de cache-busting, une mise à jour resterait
invisible pour les visiteurs déjà venus.

| Chemin | Cache-Control |
|---|---|
| `/fonts/*`, `/js/vendor/*` | `max-age=31536000, immutable` |
| `/images/*` | `max-age=2592000, stale-while-revalidate=86400` |
| `/js/*`, `/css/*` | `max-age=604800, stale-while-revalidate=86400` |
| HTML | pas de règle dédiée (comportement par défaut Cloudflare) |

## SEO

`sitemap.xml` déclare les URL du site, toutes sur l'hôte `www`. Après toute
modification de contenu, penser à mettre à jour le `lastmod` correspondant et
à resoumettre le sitemap dans Search Console : Google ne le relit pas
spontanément.

Les 6 pages de `demos/` sont volontairement en `noindex, nofollow`. Ne pas les
passer en `Disallow` dans `robots.txt` : Google ne verrait alors plus la balise
`noindex` et pourrait les indexer quand même.

## Performance

Le score PageSpeed Insights (mobile et bureau) est suivi comme indicateur de
qualité, pas comme objectif en soi - Google classe sur les données terrain
(CrUX), pas sur le score de laboratoire Lighthouse. Deux causes de CLS non
évidentes rencontrées le 2026-09-03, utiles si un score se dégrade à nouveau :

1. **CSS différé qui stylait une section visible au premier écran.** Avant de
   différer une feuille de style, vérifier qu'aucune section qu'elle stylise
   n'est dans le premier viewport, à chaque largeur d'écran testée.
2. **Contenu injecté de façon asynchrone sans hauteur réservée** (widget
   Turnstile, bandeau cookies). Toute zone qui reste vide puis se remplit
   après le premier rendu doit avoir un `min-height` correspondant à son
   contenu final.

Méthode de vérification fiable (PageSpeed Insights a un cache par URL et une
vraie variance de mesure d'un run à l'autre) : reproduire le mécanisme exact
dans une iframe same-origin à la largeur réelle et lire
`performance.getEntriesByType('layout-shift')`, plutôt que de se fier à un
seul rapport PSI.
