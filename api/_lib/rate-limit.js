// Limitation de debit des formulaires.
//
// Pourquoi : le honeypot et le delai minimum de remplissage ne filtrent que les
// bots naifs. Le delai s'appuie sur un `ts` envoye par le client, donc
// falsifiable en une ligne. Sans plafond, n'importe qui peut poster en boucle :
// chaque envoi consomme un email Brevo (quota gratuit 300/jour) et un upsert
// contact. Saturer le quota rendrait les vrais prospects invisibles.
//
// Limite connue : le stockage est en memoire, donc propre a chaque instance de
// fonction. Vercel peut en faire tourner plusieurs en parallele et les recycle
// regulierement, donc les compteurs ne sont pas partages ni persistants. Cela
// arrete un attaquant qui martele le formulaire (il retombe sur une instance
// chaude), pas une attaque distribuee. Pour un plafond strict il faudrait un
// stockage externe (Vercel KV, Upstash, ou la base Supabase deja branchee).

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PER_IP = 5; // envois autorises par IP sur la fenetre
const MAX_GLOBAL = 60; // garde-fou instance, protege le quota Brevo

const hitsByIp = new Map();
let globalHits = [];

function prune(list, now) {
  const cutoff = now - WINDOW_MS;
  let i = 0;
  while (i < list.length && list[i] <= cutoff) i += 1;
  return i === 0 ? list : list.slice(i);
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  if (Array.isArray(fwd) && fwd.length > 0) return String(fwd[0]).trim();
  return req.headers['x-real-ip'] || 'inconnue';
}

// Renvoie { limited, retryAfter } ; enregistre le hit quand il est accepte.
export function checkRateLimit(req) {
  const now = Date.now();
  const ip = clientIp(req);

  globalHits = prune(globalHits, now);
  const previous = prune(hitsByIp.get(ip) || [], now);

  // Purge des IP devenues inactives, sinon la Map grossit indefiniment.
  if (hitsByIp.size > 5000) {
    for (const [key, list] of hitsByIp) {
      if (prune(list, now).length === 0) hitsByIp.delete(key);
    }
  }

  if (previous.length >= MAX_PER_IP || globalHits.length >= MAX_GLOBAL) {
    const oldest = previous.length >= MAX_PER_IP ? previous[0] : globalHits[0];
    hitsByIp.set(ip, previous);
    return {
      limited: true,
      retryAfter: Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000)),
    };
  }

  previous.push(now);
  globalHits.push(now);
  hitsByIp.set(ip, previous);
  return { limited: false, retryAfter: 0 };
}

// Applique la limite et repond 429 le cas echeant. Renvoie true si la requete
// doit s'arreter la.
export function enforceRateLimit(req, res) {
  const { limited, retryAfter } = checkRateLimit(req);
  if (!limited) return false;
  res.setHeader('Retry-After', String(retryAfter));
  res.status(429).json({ error: 'rate_limited', retryAfter });
  return true;
}
