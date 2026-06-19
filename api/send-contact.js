function normalizeFrenchPhone(tel) {
  if (!tel) return '';
  const digits = tel.replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) return '33' + digits.slice(1);
  return digits;
}

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
        to: [{ email: 'contact@abiweb.fr' }],
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
        const attributes = {
          PRENOM: data.nom || '',
          NOM: data.formule ? `Contact rapide — ${data.formule}` : 'Contact rapide',
        };
        const sms = normalizeFrenchPhone(data.tel);
        if (sms) attributes.SMS = sms;

        const contactRes = await fetch('https://api.brevo.com/v3/contacts', {
          method: 'POST',
          headers: {
            'api-key': process.env.BREVO_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: data.email,
            attributes,
            listIds: [2],
            updateEnabled: true,
          }),
        });

        if (!contactRes.ok) {
          console.error('Brevo contact upsert failed:', await contactRes.text());
        }
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
