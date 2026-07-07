import { timingSafeEqual } from 'node:crypto';

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function secretMatches(provided, expected) {
  if (typeof provided !== 'string' || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};

  if (!secretMatches(body.secret, process.env.NOTIFY_SECRET)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const type = body.type === 'issue' ? 'issue' : 'pr';
  const clientNom = String(body.clientNom || '').trim().slice(0, 200);
  const url = String(body.url || '').trim().slice(0, 300);

  if (!clientNom || !/^https:\/\/github\.com\//.test(url)) {
    res.status(400).json({ error: 'invalid_input' });
    return;
  }

  const label = type === 'issue' ? 'Action manuelle requise' : 'Nouvelle PR client à relire';
  const verb = type === 'issue' ? 'nécessite une intervention manuelle' : 'est prête à être relue';

  try {
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
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
      res.status(502).json({ error: 'send_failed' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Server error (notify-pr):', err);
    res.status(500).json({ error: 'server_error' });
  }
}
