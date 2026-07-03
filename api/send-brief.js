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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};

  // Honeypot : champ invisible pour les humains — rempli, c'est un bot.
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
    ? `Sur mesure — ${data.totalEstime}€`
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
Site existant : ${data.siteExistant === 'oui' ? 'Oui — refonte' + (data.siteUrl ? ' (' + data.siteUrl + ')' : '') : 'Non — 1er site'}

--- TARIFICATION ---
Mode : ${tarifMode}
${tarifDetail}
Maintenance : ${data.maintenance || 'Non précisé'}
Domaine : ${domaineLabel}${data.domaineNom ? ' — ' + data.domaineNom : ''}

--- CONTENU ---
Sections souhaitées : ${data.sections.length ? data.sections.join(', ') : 'Non précisé'}
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
Couleur principale : ${data.couleur1}
Couleur secondaire : ${data.couleur2}
Précisions couleurs : ${data.couleursTexte || 'Aucune'}
Références : ${data.refs || 'Aucune'}
À éviter : ${data.refNon || 'Aucun'}

--- INFOS COMPLÉMENTAIRES ---
${data.infos || 'Aucune'}
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
        replyTo: { email: data.email },
        subject: `Brief AbiWeb — ${data.nom} (${tarifLabel})`,
        textContent: text,
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
        NOM: `${data.nom} — ${tarifLabel}`,
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
