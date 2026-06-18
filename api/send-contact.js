export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const data = req.body || {};

  const text = `=== CONTACT RAPIDE ABIWEB ===

Nom : ${data.nom || ''}
Email : ${data.email || ''}
Téléphone : ${data.tel || 'Non renseigné'}
Formule : ${data.formule || 'Non précisé'}

Message :
${data.message || ''}
`;

  try {
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'AbiWeb', email: 'contact@abiweb.fr' },
        to: [{ email: 'abiweb@outlook.fr' }],
        replyTo: data.email ? { email: data.email } : undefined,
        subject: `Demande de devis AbiWeb — ${data.nom || 'Sans nom'}`,
        textContent: text,
      }),
    });

    if (!brevoRes.ok) {
      const detail = await brevoRes.text();
      console.error('Brevo error:', detail);
      res.status(502).json({ error: 'send_failed' });
      return;
    }

    if (data.email) {
      try {
        await fetch('https://api.brevo.com/v3/contacts', {
          method: 'POST',
          headers: {
            'api-key': process.env.BREVO_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: data.email,
            attributes: {
              PRENOM: data.nom || '',
              NOM: data.formule ? `Contact rapide — ${data.formule}` : 'Contact rapide',
              SMS: data.tel || '',
            },
            listIds: [2],
            updateEnabled: true,
          }),
        });
      } catch (err) {
        console.error('Brevo contact upsert error:', err);
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'server_error' });
  }
}
