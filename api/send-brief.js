export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const data = req.body || {};

  const domaineLabel =
    data.domaine === 'non' ? 'Non, à acheter'
    : data.domaine === 'oui' ? 'Oui, déjà acheté'
    : 'Adresse gratuite (vercel.app)';

  const text = `=== BRIEF CLIENT ABIWEB ===

--- CONTACT ---
Structure : ${data.nom || ''}
Type : ${data.type || ''}
Nom contact : ${data.contact || ''}
Email : ${data.email || ''}
Téléphone : ${data.tel || 'Non renseigné'}
Ville : ${data.ville || 'Non renseignée'}
Activité : ${data.activite || ''}
Site existant : ${data.siteExistant === 'oui' ? 'Oui — refonte' + (data.siteUrl ? ' (' + data.siteUrl + ')' : '') : 'Non — 1er site'}

--- FORMULE ---
Formule : ${data.formule || 'Non précisé'}
Domaine : ${domaineLabel}${data.domaineNom ? ' — ' + data.domaineNom : ''}

--- CONTENU ---
Sections souhaitées : ${(data.sections && data.sections.length) ? data.sections.join(', ') : 'Non précisé'}
Photos : ${data.photos || 'Non précisé'} — Nombre : ${data.photosNb || 'Non précisé'}
Vidéos : ${data.videos || 'Non précisé'}
Logo : ${data.logo || 'Non précisé'}
Textes : ${data.textes || 'Non précisé'}
Facebook : ${data.fbLink || 'Aucun'}
Instagram : ${data.igLink || 'Aucun'}
YouTube : ${data.ytLink || 'Aucun'}
Autre lien : ${data.autreLink || 'Aucun'}

--- DESIGN ---
Style : ${data.style || 'Non précisé'}
Couleur principale : ${data.couleur1 || ''}
Couleur secondaire : ${data.couleur2 || ''}
Précisions couleurs : ${data.couleursTexte || 'Aucune'}
Références : ${data.refs || 'Aucune'}
À éviter : ${data.refNon || 'Aucun'}

--- INFOS COMPLÉMENTAIRES ---
${data.infos || 'Aucune'}
`;

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AbiWeb Brief <onboarding@resend.dev>',
        to: ['abiweb@outlook.fr'],
        reply_to: data.email || undefined,
        subject: `Brief AbiWeb — ${data.nom || 'Sans nom'} (${data.formule || ''})`,
        text,
      }),
    });

    if (!resendRes.ok) {
      const detail = await resendRes.text();
      console.error('Resend error:', detail);
      res.status(502).json({ error: 'send_failed' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'server_error' });
  }
}
