const LIMITS = {
  nom: 100,
  email: 254,
  tel: 30,
  formule: 60,
  message: 5000,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function clean(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function normalizeFrenchPhone(tel) {
  if (!tel) return '';
  const digits = tel.replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) return '33' + digits.slice(1);
  return digits;
}

// Les données client sont échappées avant insertion dans le HTML de l'email.
function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escMultiline(value) {
  return esc(value).replace(/\n/g, '<br />');
}

function htmlRow(label, valueHtml) {
  return `<tr>
    <td style="padding:7px 16px 7px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b6b72;vertical-align:top;width:140px;">${label}</td>
    <td style="padding:7px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f0f11;line-height:1.5;">${valueHtml}</td>
  </tr>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};

  // Honeypot : champ invisible pour les humains - rempli, c'est un bot.
  // On répond un faux succès pour ne pas lui signaler le rejet.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    res.status(200).json({ ok: true });
    return;
  }

  const data = {
    nom: clean(body.nom, LIMITS.nom),
    email: clean(body.email, LIMITS.email),
    tel: clean(body.tel, LIMITS.tel),
    formule: clean(body.formule, LIMITS.formule),
    message: clean(body.message, LIMITS.message),
  };

  if (!data.nom || !data.message || !EMAIL_RE.test(data.email)) {
    res.status(400).json({ error: 'invalid_input' });
    return;
  }

  const text = `=== CONTACT RAPIDE ABIWEB ===

Nom : ${data.nom}
Email : ${data.email}
Téléphone : ${data.tel || 'Non renseigné'}
Formule : ${data.formule || 'Non précisé'}

Message :
${data.message}
`;

  const rows = [
    htmlRow('Nom', `<strong>${esc(data.nom)}</strong>`),
    htmlRow('Email', `<a href="mailto:${esc(data.email)}" style="color:#3b5bdb;">${esc(data.email)}</a>`),
    htmlRow('Téléphone', esc(data.tel) || 'Non renseigné'),
    htmlRow('Formule', esc(data.formule) || 'Non précisé'),
  ];

  const html = `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background-color:#f8f7f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f7f4;">
    <tr><td align="center" style="padding:28px 12px;">
      <table cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;background-color:#ffffff;border-radius:14px;border:1px solid #e2e1de;">
        <tr><td style="background-color:#0f0f11;border-radius:13px 13px 0 0;padding:22px 28px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#ffffff;">Abi<span style="color:#8fa3ec;">Web</span></p>
          <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#9a9aa2;">Nouveau message reçu via abiweb.fr</p>
        </td></tr>
        <tr><td style="padding:24px 28px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">${rows.join('')}</table>
        </td></tr>
        <tr><td style="padding:22px 28px 0;">
          <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.5px;color:#3b5bdb;text-transform:uppercase;">Message</p>
          <p style="margin:0;padding:14px 16px;background-color:#f8f7f4;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f0f11;line-height:1.6;">${escMultiline(data.message)}</p>
        </td></tr>
        <tr><td style="padding:24px 28px 30px;">
          <a href="mailto:${esc(data.email)}?subject=${encodeURIComponent('Re : votre demande - AbiWeb')}" style="display:inline-block;background-color:#3b5bdb;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:12px 24px;border-radius:8px;">Répondre à ${esc(data.nom)}</a>
        </td></tr>
      </table>
      <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a9aa2;">Email automatique - formulaire contact de abiweb.fr</p>
    </td></tr>
  </table>
</body>
</html>`;

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
        replyTo: { email: data.email },
        subject: `Demande de devis AbiWeb - ${data.nom}`,
        textContent: text,
        htmlContent: html,
      }),
    });

    if (!brevoRes.ok) {
      const detail = await brevoRes.text();
      console.error('Brevo error:', detail);
      res.status(502).json({ error: 'send_failed' });
      return;
    }

    try {
      const attributes = {
        PRENOM: data.nom,
        NOM: data.formule ? `Contact rapide - ${data.formule}` : 'Contact rapide',
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

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'server_error' });
  }
}
