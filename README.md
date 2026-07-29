# abiweb.fr

Site vitrine d'AbiWeb, service de création de sites internet clé en main pour
associations, TPE, commerçants et auto-entrepreneurs.

Production : <https://www.abiweb.fr>

## Architecture

Site statique sans étape de build : le dépôt est déployé tel quel par Vercel.
Il n'y a ni framework, ni bundler, ni transpilation. Ouvrir un fichier HTML
dans un navigateur suffit à voir la page (aux appels `/api/*` près).

```
index.html                       accueil : tarifs, simulateur, démos, formulaire
devis/                           formulaire de brief en 5 étapes
cgv/  mentions-legales/  politique-de-confidentialite/
demos/<secteur>/                 6 maquettes fictives, affichées en iframe
                                 sur l'accueil, toutes en noindex
404.html                         page d'erreur servie par Vercel

css/shared.css                   @font-face, design tokens, footer, bandeau
                                 cookies, accessibilité. Chargé par les 6 pages
fonts/                           polices auto-hébergées (voir plus bas)
js/pricing-data.js               source de vérité des tarifs côté client
js/home.js  js/devis.js          logique des formulaires
js/analytics-loader.js  js/cookie-banner.js

api/send-contact.js              formulaire de contact rapide
api/send-brief.js                brief détaillé depuis /devis
api/notify-pr.js                 notification email des PR automatiques
api/_lib/email-utils.js          envoi Brevo, échappement HTML, upsert contact
api/_lib/pricing.js              miroir serveur des tarifs
api/_lib/rate-limit.js           plafonnement des envois

vercel.json                      redirections, en-têtes de sécurité, cache
```

Les styles propres à une page restent dans son `<style>` : les thèmes de
l'accueil (sombre) et de `/devis` (clair) divergent trop pour être mutualisés.
Seul ce qui est strictement identique partout vit dans `css/shared.css`.

Les routes `/api/*` sont des fonctions serverless Vercel en ESM
(`export default async function handler(req, res)`), exécutées sur Node.

## Variables d'environnement

À configurer dans Vercel (Settings → Environment Variables). Aucune n'a de
valeur par défaut dans le code, et aucune ne doit être commitée : **le dépôt
est public.**

| Variable | Utilisée par | Rôle |
|---|---|---|
| `BREVO_API_KEY` | `_lib/email-utils.js` | Envoi des emails et création des contacts via l'API Brevo |
| `SUPABASE_URL` | `send-brief.js` | Insertion de chaque brief dans la table `briefs` |
| `SUPABASE_ANON_KEY` | `send-brief.js` | Idem |
| `NOTIFY_SECRET` | `notify-pr.js` | Secret partagé protégeant la route de notification |

L'insertion Supabase est non bloquante : un échec n'empêche pas l'envoi de
l'email. Si `SUPABASE_URL` ou `SUPABASE_ANON_KEY` est absente, l'insertion est
simplement ignorée.

## Services externes

- **Hébergement** : Vercel, projet `abiweb-site`, branche de production `master`.
  Le plan Hobby refuse de déployer depuis un dépôt privé — le déploiement finit
  en état `BLOCKED` avant le build, sans log. **Le dépôt doit rester public.**
- **Email transactionnel** : Brevo. Expéditeur vérifié `AbiWeb <contact@abiweb.fr>`,
  domaine authentifié DKIM/DMARC. Chaque soumission crée aussi un contact dans
  la liste Brevo `2`. L'attribut `SMS` attend un format international
  (`33XXXXXXXXX`), la normalisation est faite par `normalizeFrenchPhone`.
- **Domaine et DNS** : Infomaniak. L'apex `abiweb.fr` redirige en 308 vers
  `www.abiweb.fr`, qui est l'hôte canonique — toute URL absolue (canonical,
  sitemap, Open Graph) doit utiliser `www`.
- **Mesure d'audience** : Google Tag Manager et Google Analytics, chargés
  uniquement après acceptation du bandeau cookies (clé `abiweb-consent` dans
  `localStorage`). Vercel Analytics, sans cookie, est actif sur toutes les pages.

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

## Sécurité

- En-têtes définis dans `vercel.json` : CSP, HSTS, `X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
  L'accueil autorise `frame-src 'self'` (iframe des démos) et `/demos/*`
  autorise `frame-ancestors 'self'` ; tout le reste est verrouillé.
- Les deux formulaires valident côté serveur (champs requis, regex email,
  plafonds de longueur), utilisent un honeypot (`website`) et un délai minimum
  de remplissage, et échappent toute donnée client insérée dans le HTML des
  emails.
- `api/_lib/rate-limit.js` plafonne à 5 envois par IP sur 10 minutes. Le
  stockage est en mémoire, donc par instance de fonction : cela arrête un
  attaquant isolé, pas une attaque distribuée. Pour un plafond strict, il
  faudrait passer par Supabase ou Vercel KV.

## Développement

```sh
npm install        # eslint uniquement
npm run lint       # doit sortir sans erreur ni warning
npm run dev        # vercel dev, nécessaire pour tester les routes /api/*
```

Sans `vercel dev`, un simple serveur statique suffit pour travailler sur le
HTML/CSS, mais les formulaires échoueront faute de routes `/api/*`.

La CI GitHub Actions exécute `npm run lint` sur chaque push et chaque PR.

## Cache

`vercel.json` fixe des durées distinctes selon le type de fichier. Les noms de
fichiers ne sont pas hashés : ne pas mettre `immutable` sur `/js/*` ou `/css/*`,
une mise à jour resterait invisible pour les visiteurs déjà venus.

| Chemin | Cache-Control |
|---|---|
| `/fonts/*` | `max-age=31536000, immutable` |
| `/images/*` | `max-age=604800, stale-while-revalidate=86400` |
| `/js/*`, `/css/*` | `max-age=3600, stale-while-revalidate=86400` |
| HTML | `max-age=0, must-revalidate` (défaut Vercel, voulu) |

## SEO

`sitemap.xml` déclare 5 URL, toutes sur l'hôte `www`. Après toute modification
de contenu, penser à mettre à jour le `lastmod` correspondant et à resoumettre
le sitemap dans Search Console : Google ne le relit pas spontanément (il s'est
écoulé plus de trois semaines entre deux lectures en juillet 2026).

Les 6 pages de `demos/` sont volontairement en `noindex, nofollow`. Ne pas les
passer en `Disallow` dans `robots.txt` : Google ne verrait alors plus la balise
`noindex` et pourrait les indexer quand même.
