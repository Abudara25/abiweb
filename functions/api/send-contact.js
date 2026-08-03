import {
  EMAIL_RE,
  clean,
  normalizeFrenchPhone,
  esc,
  escMultiline,
  htmlRow,
  sendBrevoEmail,
  upsertBrevoContact,
  sendFailureAlert,
} from './_lib/email-utils.js';
import { enforceRateLimit } from './_lib/rate-limit.js';

const LIMITS = {
  nom: 100,
  email: 254,
  tel: 30,
  formule: 60,
  message: 5000,
};

// Un humain ne peut pas remplir ce formulaire en moins de 3s - filtre les bots qui postent direct.
const MIN_FILL_MS = 3000;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export async function onRequestPost({ request, env }) {
  // Plafonne les envois avant tout traitement : un abus ne doit pas consommer
  // le quota Brevo ni noyer la boite contact@abiweb.fr.
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  if (!body || typeof body !== 'object') body = {};

  // Honeypot : champ invisible pour les humains - rempli, c'est un bot.
  // On répond un faux succès pour ne pas lui signaler le rejet.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return json({ ok: true });
  }

  const elapsed = Date.now() - Number(body.ts);
  if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) {
    return json({ ok: true });
  }

  const data = {
    nom: clean(body.nom, LIMITS.nom),
    email: clean(body.email, LIMITS.email),
    tel: clean(body.tel, LIMITS.tel),
    formule: clean(body.formule, LIMITS.formule),
    message: clean(body.message, LIMITS.message),
  };

  if (!data.nom || !data.message || !EMAIL_RE.test(data.email)) {
    return json({ error: 'invalid_input' }, 400);
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
    const brevoRes = await sendBrevoEmail(env, {
      to: 'contact@abiweb.fr',
      replyTo: data.email,
      subject: `Demande de devis AbiWeb - ${data.nom}`,
      textContent: text,
      htmlContent: html,
    });

    if (!brevoRes.ok) {
      const detail = await brevoRes.text();
      console.error('Brevo error:', detail);
      return json({ error: 'send_failed' }, 502);
    }

    try {
      const attributes = {
        PRENOM: data.nom,
        NOM: data.formule ? `Contact rapide - ${data.formule}` : 'Contact rapide',
      };
      const sms = normalizeFrenchPhone(data.tel);
      if (sms) attributes.SMS = sms;

      const contactRes = await upsertBrevoContact(env, { email: data.email, attributes });

      if (!contactRes.ok) {
        console.error('Brevo contact upsert failed:', await contactRes.text());
      }
    } catch (err) {
      console.error('Brevo contact upsert error:', err);
    }

    return json({ ok: true });
  } catch (err) {
    console.error('Server error:', err);
    await sendFailureAlert(env, 'send-contact - erreur serveur inattendue', err && err.message ? err.message : err);
    return json({ error: 'server_error' }, 500);
  }
}
