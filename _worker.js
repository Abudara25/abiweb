import { onRequestPost as sendContact } from './functions/api/send-contact.js';
import { onRequestPost as sendBrief } from './functions/api/send-brief.js';
import { onRequestPost as notifyPr } from './functions/api/notify-pr.js';

// Routeur du Worker : assets.directory couvre tout le repo, donc seules les
// requetes qui ne correspondent a aucun fichier statique arrivent ici
// (comportement par defaut de Workers Static Assets). On ne branche que /api/*.
const ROUTES = {
  '/api/send-contact': sendContact,
  '/api/send-brief': sendBrief,
  '/api/notify-pr': notifyPr,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const handler = ROUTES[url.pathname];

    if (handler) {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
          status: 405,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return handler({ request, env, ctx });
    }

    // suivi.abiweb.fr n'a pas son propre projet : le contenu vit dans
    // /suivi-abiweb sur ce meme Worker. On reecrit le chemin pour ce host
    // uniquement, les liens relatifs (style.css, script.js) suivent.
    if (url.hostname === 'suivi.abiweb.fr') {
      const rewritten = new URL(request.url);
      rewritten.pathname = `/suivi-abiweb${url.pathname}`;
      return env.ASSETS.fetch(new Request(rewritten, request));
    }

    return env.ASSETS.fetch(request);
  },
};
