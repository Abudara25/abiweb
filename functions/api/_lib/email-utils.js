export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function clean(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

export function cleanList(value, maxItems, maxLen) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s) => typeof s === 'string')
    .slice(0, maxItems)
    .map((s) => s.trim().slice(0, maxLen));
}

export function normalizeFrenchPhone(tel) {
  if (!tel) return '';
  const digits = tel.replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) return '33' + digits.slice(1);
  return digits;
}

// Les données client sont échappées avant insertion dans le HTML de l'email.
export function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escMultiline(value) {
  return esc(value).replace(/\n/g, '<br />');
}

export function htmlRow(label, valueHtml, labelWidth) {
  return `<tr>
    <td style="padding:7px 16px 7px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b6b72;vertical-align:top;width:${labelWidth || 140}px;">${label}</td>
    <td style="padding:7px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f0f11;line-height:1.5;">${valueHtml}</td>
  </tr>`;
}

// UTF-8 safe base64 encode - remplace Buffer.from(...).toString('base64'),
// indisponible sans le flag de compat Node sur Cloudflare Pages Functions.
export function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function sendBrevoEmail(env, { to, subject, textContent, htmlContent, replyTo, attachment }) {
  const payload = {
    sender: { name: 'AbiWeb', email: 'contact@abiweb.fr' },
    to: [{ email: to }],
    subject,
    textContent,
    htmlContent,
  };
  if (replyTo) payload.replyTo = { email: replyTo };
  if (attachment) payload.attachment = attachment;

  return fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function upsertBrevoContact(env, { email, attributes }) {
  return fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, attributes, listIds: [2], updateEnabled: true }),
  });
}

// Alerte discrète en cas d'échec silencieux (ex : insertion Supabase KO) - best effort,
// ne doit jamais faire échouer la requête principale qui l'appelle.
export async function sendFailureAlert(env, context, detail) {
  try {
    await sendBrevoEmail(env, {
      to: 'contact@abiweb.fr',
      subject: `[AbiWeb] Erreur silencieuse - ${context}`,
      textContent: `Une erreur non bloquante est survenue côté serveur.\n\nContexte : ${context}\nDétail : ${detail}`,
      htmlContent: `<p><strong>Erreur non bloquante côté serveur</strong></p><p>Contexte : ${esc(context)}</p><p>Détail : ${esc(String(detail))}</p>`,
    });
  } catch (err) {
    console.error('Failure-alert email failed:', err);
  }
}
