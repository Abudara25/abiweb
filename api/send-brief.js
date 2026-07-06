const LIMITS = {
  nom: 120,
  type: 60,
  contact: 100,
  email: 254,
  tel: 30,
  ville: 100,
  activite: 1000,
  siteUrl: 300,
  formule: 60,
  tarifMode: 20,
  maintenance: 80,
  domaine: 20,
  domaineNom: 120,
  photos: 40,
  photosNb: 40,
  videos: 20,
  logo: 40,
  textes: 80,
  fbLink: 300,
  igLink: 300,
  ytLink: 300,
  autreLink: 300,
  style: 60,
  couleur1: 30,
  couleur2: 30,
  couleursTexte: 300,
  refs: 500,
  refNon: 300,
  infos: 3000,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function clean(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function cleanList(value, maxItems, maxLen) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s) => typeof s === 'string')
    .slice(0, maxItems)
    .map((s) => s.trim().slice(0, maxLen));
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

function safeColor(value) {
  return /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : '';
}

function htmlLink(url) {
  if (!url) return '';
  return /^https?:\/\//i.test(url)
    ? `<a href="${esc(url)}" style="color:#3b5bdb;">${esc(url)}</a>`
    : esc(url);
}

function htmlRow(label, valueHtml) {
  return `<tr>
    <td style="padding:7px 16px 7px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b6b72;vertical-align:top;width:170px;">${label}</td>
    <td style="padding:7px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f0f11;line-height:1.5;">${valueHtml}</td>
  </tr>`;
}

function htmlSection(title, rows) {
  return `<tr><td style="padding:22px 28px 0;">
    <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.5px;color:#3b5bdb;text-transform:uppercase;">${title}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e1de;">${rows.join('')}</table>
  </td></tr>`;
}

function colorChip(hex) {
  const safe = safeColor(hex);
  if (!safe) return 'Non précisé';
  return `<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background-color:${safe};border:1px solid #d5d4d0;">&nbsp;</span>&nbsp;${esc(safe)}`;
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

  const data = {};
  for (const [field, max] of Object.entries(LIMITS)) {
    data[field] = clean(body[field], max);
  }
  data.siteExistant = body.siteExistant === 'oui' ? 'oui' : 'non';
  data.sections = cleanList(body.sections, 20, 100);
  data.modulesChoisis = cleanList(body.modulesChoisis, 20, 100);
  data.totalEstime = Number.isFinite(Number(body.totalEstime))
    ? Math.max(0, Math.min(100000, Math.round(Number(body.totalEstime))))
    : 0;

  if (!data.nom || !data.contact || !data.activite || !EMAIL_RE.test(data.email)) {
    res.status(400).json({ error: 'invalid_input' });
    return;
  }

  const domaineLabel =
    data.domaine === 'non' ? 'Non, à acheter'
    : data.domaine === 'oui' ? 'Oui, déjà acheté'
    : 'Adresse gratuite (vercel.app)';

  const tarifMode = data.tarifMode === 'alacarte' ? 'Sur mesure à la carte' : 'Formule clé en main';
  const tarifLabel = data.tarifMode === 'alacarte'
    ? `Sur mesure - ${data.totalEstime}€`
    : (data.formule || 'Non précisé');
  const tarifDetail = data.tarifMode === 'alacarte'
    ? `Modules : ${data.modulesChoisis.length ? data.modulesChoisis.join(', ') : 'Base seule'}\nTotal estimé : ${data.totalEstime}€`
    : `Formule : ${data.formule || 'Non précisé'}`;

  const text = `=== BRIEF CLIENT ABIWEB ===

--- CONTACT ---
Structure : ${data.nom}
Type : ${data.type}
Nom contact : ${data.contact}
Email : ${data.email}
Téléphone : ${data.tel || 'Non renseigné'}
Ville : ${data.ville || 'Non renseignée'}
Activité : ${data.activite}
Site existant : ${data.siteExistant === 'oui' ? 'Oui - refonte' + (data.siteUrl ? ' (' + data.siteUrl + ')' : '') : 'Non - 1er site'}

--- TARIFICATION ---
Mode : ${tarifMode}
${tarifDetail}
Maintenance : ${data.maintenance || 'Non précisé'}
Domaine : ${domaineLabel}${data.domaineNom ? ' - ' + data.domaineNom : ''}

--- CONTENU ---
Sections souhaitées : ${data.sections.length ? data.sections.join(', ') : 'Non précisé'}
Photos : ${data.photos || 'Non précisé'} - Nombre : ${data.photosNb || 'Non précisé'}
Vidéos : ${data.videos || 'Non précisé'}
Logo : ${data.logo || 'Non précisé'}
Textes : ${data.textes || 'Non précisé'}
Facebook : ${data.fbLink || 'Aucun'}
Instagram : ${data.igLink || 'Aucun'}
YouTube : ${data.ytLink || 'Aucun'}
Autre lien : ${data.autreLink || 'Aucun'}

--- DESIGN ---
Style : ${data.style || 'Non précisé'}
Couleur principale : ${data.couleur1}
Couleur secondaire : ${data.couleur2}
Précisions couleurs : ${data.couleursTexte || 'Aucune'}
Références : ${data.refs || 'Aucune'}
À éviter : ${data.refNon || 'Aucun'}

--- INFOS COMPLÉMENTAIRES ---
${data.infos || 'Aucune'}
`;

  const contactRows = [
    htmlRow('Structure', `<strong>${esc(data.nom)}</strong>`),
    htmlRow('Type', esc(data.type) || 'Non précisé'),
    htmlRow('Contact', esc(data.contact)),
    htmlRow('Email', `<a href="mailto:${esc(data.email)}" style="color:#3b5bdb;">${esc(data.email)}</a>`),
    htmlRow('Téléphone', esc(data.tel) || 'Non renseigné'),
    htmlRow('Ville', esc(data.ville) || 'Non renseignée'),
    htmlRow('Activité', escMultiline(data.activite)),
    htmlRow('Site existant', data.siteExistant === 'oui'
      ? 'Oui - refonte' + (data.siteUrl ? ' (' + htmlLink(data.siteUrl) + ')' : '')
      : 'Non - 1er site'),
  ];

  const tarifRows = [
    htmlRow('Mode', esc(tarifMode)),
    data.tarifMode === 'alacarte'
      ? htmlRow('Modules', esc(data.modulesChoisis.length ? data.modulesChoisis.join(', ') : 'Base seule'))
      : htmlRow('Formule', esc(data.formule) || 'Non précisé'),
  ];
  if (data.tarifMode === 'alacarte') {
    tarifRows.push(htmlRow('Total estimé', `<strong>${data.totalEstime}&nbsp;€</strong>`));
  }
  tarifRows.push(htmlRow('Maintenance', esc(data.maintenance) || 'Non précisé'));
  tarifRows.push(htmlRow('Domaine', esc(domaineLabel) + (data.domaineNom ? ' - ' + esc(data.domaineNom) : '')));

  const contenuRows = [
    htmlRow('Sections', esc(data.sections.length ? data.sections.join(', ') : 'Non précisé')),
    htmlRow('Photos', (esc(data.photos) || 'Non précisé') + (data.photosNb ? ' - ' + esc(data.photosNb) : '')),
    htmlRow('Vidéos', esc(data.videos) || 'Non précisé'),
    htmlRow('Logo', esc(data.logo) || 'Non précisé'),
    htmlRow('Textes', esc(data.textes) || 'Non précisé'),
    htmlRow('Facebook', htmlLink(data.fbLink) || 'Aucun'),
    htmlRow('Instagram', htmlLink(data.igLink) || 'Aucun'),
    htmlRow('YouTube', htmlLink(data.ytLink) || 'Aucun'),
    htmlRow('Autre lien', htmlLink(data.autreLink) || 'Aucun'),
  ];

  const designRows = [
    htmlRow('Style', esc(data.style) || 'Non précisé'),
    htmlRow('Couleur principale', colorChip(data.couleur1)),
    htmlRow('Couleur secondaire', colorChip(data.couleur2)),
    htmlRow('Précisions couleurs', esc(data.couleursTexte) || 'Aucune'),
    htmlRow('Références', esc(data.refs) || 'Aucune'),
    htmlRow('À éviter', esc(data.refNon) || 'Aucun'),
  ];

  const html = `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background-color:#f8f7f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f7f4;">
    <tr><td align="center" style="padding:28px 12px;">
      <table cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;background-color:#ffffff;border-radius:14px;border:1px solid #e2e1de;">
        <tr><td style="background-color:#0f0f11;border-radius:13px 13px 0 0;padding:22px 28px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#ffffff;">Abi<span style="color:#8fa3ec;">Web</span></p>
          <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#9a9aa2;">Nouveau brief client reçu via abiweb.fr</p>
        </td></tr>
        <tr><td style="padding:24px 28px 0;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:#0f0f11;">${esc(data.nom)}</p>
          <p style="margin:8px 0 0;"><span style="display:inline-block;background-color:#e8f0ff;color:#3b5bdb;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;padding:4px 12px;border-radius:999px;">${esc(tarifLabel)}</span></p>
        </td></tr>
        ${htmlSection('Contact', contactRows)}
        ${htmlSection('Tarification', tarifRows)}
        ${htmlSection('Contenu', contenuRows)}
        ${htmlSection('Design', designRows)}
        ${htmlSection('Infos complémentaires', [htmlRow('Message', escMultiline(data.infos) || 'Aucune')])}
        <tr><td style="padding:26px 28px 30px;">
          <a href="mailto:${esc(data.email)}?subject=${encodeURIComponent('Re : votre projet ' + data.nom + ' - AbiWeb')}" style="display:inline-block;background-color:#3b5bdb;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:12px 24px;border-radius:8px;">Répondre à ${esc(data.contact)}</a>
        </td></tr>
      </table>
      <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a9aa2;">Email automatique - formulaire /devis de abiweb.fr</p>
    </td></tr>
  </table>
</body>
</html>`;

  // Piece jointe JSON du brief brut, pour scripts/generateur-prompt/generateur-prompt.js
  // dans abiweb-templates (evite de retranscrire le brief a la main).
  const briefJsonBase64 = Buffer.from(JSON.stringify(data, null, 2), 'utf8').toString('base64');

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
        subject: `Brief AbiWeb - ${data.nom} (${tarifLabel})`,
        textContent: text,
        htmlContent: html,
        attachment: [{ content: briefJsonBase64, name: 'brief.txt' }],
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
        PRENOM: data.contact,
        NOM: `${data.nom} - ${tarifLabel}`,
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

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const supabaseRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/briefs`, {
          method: 'POST',
          headers: {
            apikey: process.env.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            nom: data.nom,
            email: data.email,
            type: data.type,
            data,
          }),
        });

        if (!supabaseRes.ok) {
          console.error('Supabase insert failed:', await supabaseRes.text());
        }
      } catch (err) {
        console.error('Supabase insert error:', err);
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'server_error' });
  }
}
