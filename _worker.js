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

    return env.ASSETS.fetch(request);
  },
};
