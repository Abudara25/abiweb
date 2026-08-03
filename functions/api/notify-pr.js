function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Comparaison à temps constant sans node:crypto (indisponible sans flag de
// compat Node sur Cloudflare Pages Functions).
function secretMatches(provided, expected) {
  if (typeof provided !== 'string' || !expected) return false;
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i += 1) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export async function onRequestPost({ request, env }) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  if (!body || typeof body !== 'object') body = {};

  if (!secretMatches(body.secret, env.NOTIFY_SECRET)) {
    return json({ error: 'unauthorized' }, 401);
  }

  const type = body.type === 'issue' ? 'issue' : 'pr';
  const clientNom = String(body.clientNom || '').trim().slice(0, 200);
  const url = String(body.url || '').trim().slice(0, 300);

  if (!clientNom || !/^https:\/\/github\.com\//.test(url)) {
    return json({ error: 'invalid_input' }, 400);
  }

  const label = type === 'issue' ? 'Action manuelle requise' : 'Nouvelle PR client à relire';
  const verb = type === 'issue' ? 'nécessite une intervention manuelle' : 'est prête à être relue';

  try {
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'AbiWeb', email: 'contact@abiweb.fr' },
        to: [{ email: 'contact@abiweb.fr' }],
        subject: `[AbiWeb] ${label} : ${clientNom}`,
        textContent: `${label}\n\nClient : ${clientNom}\nLien : ${url}\n\nCe brief ${verb}.`,
        htmlContent: `<p><strong>${esc(label)}</strong></p><p>Client : ${esc(clientNom)}</p><p><a href="${esc(url)}">${esc(url)}</a></p><p>Ce brief ${esc(verb)}.</p>`,
      }),
    });

    if (!brevoRes.ok) {
      console.error('Brevo error (notify-pr):', await brevoRes.text());
      return json({ error: 'send_failed' }, 502);
    }

    return json({ ok: true });
  } catch (err) {
    console.error('Server error (notify-pr):', err);
    return json({ error: 'server_error' }, 500);
  }
}
