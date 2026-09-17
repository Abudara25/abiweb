import {
  EMAIL_RE,
  clean,
  cleanList,
  normalizeFrenchPhone,
  esc,
  escMultiline,
  htmlRow,
  sendBrevoEmail,
  upsertBrevoContact,
  sendFailureAlert,
  toBase64,
} from './_lib/email-utils.js';
import { moduleByKey, moduleLabels, alaCarteTotal, estimateMediaConstraints, PHOTO_OPTIONS } from './_lib/pricing.js';
import { enforceRateLimit, enforceSubmissionLimit } from './_lib/rate-limit.js';
import { enforceTurnstile } from './_lib/turnstile.js';
import { BRIEF_LIMITS as LIMITS } from '../../js/form-rules.js';
import { resolveFormule, formuleLabel, resolveMaintenance, maintenanceLabel } from './_lib/catalogue-validation.js';
import { json, invalidFields, validList, validSubmissionId, withIdempotency, continueInBackground } from './_lib/submissions.js';

function safeColor(value) {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value) ? value : '';
}

function htmlLink(url) {
  if (!url) return '';
  return /^https?:\/\//i.test(url)
    ? `<a href="${esc(url)}" style="color:#3b5bdb;">${esc(url)}</a>`
    : esc(url);
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

export async function onRequestPost({ request, env, ctx }) {
  // Plafonne les envois avant tout traitement : un abus ne doit pas consommer
  // le quota Brevo ni noyer la boite contact@abiweb.fr.
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'invalid_input' }, 400);

  // Honeypot : champ invisible pour les humains - rempli, c'est un bot.
  // On répond un faux succès pour ne pas lui signaler le rejet.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return json({ ok: true });
  }

  const fields = invalidFields(body, LIMITS);
  if (!validList(body.sections, 20, 100)) fields.push('sections');
  if (!validList(body.moduleKeys, 20, 30)) fields.push('moduleKeys');
  if (!validSubmissionId(body.submissionId)) fields.push('submissionId');
  if (fields.length) return json({ error: 'invalid_input', fields }, 400);

  const data = {};
  for (const [field, max] of Object.entries(LIMITS)) {
    data[field] = clean(body[field], max);
  }
  data.siteExistant = body.siteExistant === 'oui' ? 'oui' : 'non';
  data.sections = [...new Set(cleanList(body.sections, 20, 100))];
  const photoValues = ['', ...PHOTO_OPTIONS.map((item) => item.value), 'Moins de 5', 'Entre 5 et 10', 'Entre 10 et 20', 'Plus de 20 (Premium uniquement)'];
  if (!photoValues.includes(data.photosNb)) return json({ error: 'invalid_input', fields: ['photosNb'] }, 400);
  if (!['', 'non', '1', '2-3'].includes(data.videos)) return json({ error: 'invalid_input', fields: ['videos'] }, 400);

  // Le total et les libellés de modules sont recalculés côté serveur à partir des clés
  // envoyées par le client - on ne fait jamais confiance à un total/libellé fourni tel quel.
  let moduleKeys = [...new Set(cleanList(body.moduleKeys, 20, 30))];
  if (moduleKeys.some((key) => !moduleByKey(key))) return json({ error: 'invalid_input', fields: ['moduleKeys'] }, 400);
  if (!['forfait', 'alacarte'].includes(data.tarifMode)) return json({ error: 'invalid_input', fields: ['tarifMode'] }, 400);
  const formule = resolveFormule(data.formule);
  if (data.tarifMode === 'forfait' && !formule) return json({ error: 'invalid_input', fields: ['formule'] }, 400);
  const maintenance = resolveMaintenance(data.maintenance || 'aucune');
  if (!maintenance) return json({ error: 'invalid_input', fields: ['maintenance'] }, 400);
  data.maintenanceKey = maintenance.key;
  data.maintenance = maintenanceLabel(maintenance);
  data.formuleKey = data.tarifMode === 'forfait' ? formule.key : '';
  data.formule = data.tarifMode === 'forfait' ? formuleLabel(formule) : '';
  if (data.tarifMode === 'forfait') moduleKeys = [...formule.modules];
  data.moduleKeys = moduleKeys;
  data.modulesChoisis = moduleLabels(moduleKeys);
  data.totalEstime = data.tarifMode === 'alacarte' ? alaCarteTotal(moduleKeys) : formule.price;
  Object.assign(data, estimateMediaConstraints({ ...data, formule: data.formuleKey }));

  if (!data.nom || !data.contact || !data.activite || !EMAIL_RE.test(data.email)) {
    return json({ error: 'invalid_input' }, 400);
  }

  return withIdempotency(request, 'brief', body.submissionId, data, async () => {
    const turnstileRejection = await enforceTurnstile(request, env, body.turnstileToken, 'brief');
    if (turnstileRejection) return turnstileRejection;
    const quota = enforceSubmissionLimit();
    if (quota) return quota;
    return sendBriefEmail(data, env, ctx);
  });
}

async function sendBriefEmail(data, env, ctx) {
  const domaineLabel =
    data.domaine === 'non' ? 'Non, à acheter'
    : data.domaine === 'oui' ? 'Oui, déjà acheté'
    : 'Adresse gratuite offerte par l\'hébergeur';

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
${data.estimationStatus === 'custom' ? 'Hors estimation : ' + data.estimationReasons.join(' ') : ''}
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
    htmlRow('Structure', `<strong>${esc(data.nom)}</strong>`, 170),
    htmlRow('Type', esc(data.type) || 'Non précisé', 170),
    htmlRow('Contact', esc(data.contact), 170),
    htmlRow('Email', `<a href="mailto:${esc(data.email)}" style="color:#3b5bdb;">${esc(data.email)}</a>`, 170),
    htmlRow('Téléphone', esc(data.tel) || 'Non renseigné', 170),
    htmlRow('Ville', esc(data.ville) || 'Non renseignée', 170),
    htmlRow('Activité', escMultiline(data.activite), 170),
    htmlRow('Site existant', data.siteExistant === 'oui'
      ? 'Oui - refonte' + (data.siteUrl ? ' (' + htmlLink(data.siteUrl) + ')' : '')
      : 'Non - 1er site', 170),
  ];

  const tarifRows = [
    htmlRow('Mode', esc(tarifMode), 170),
    data.tarifMode === 'alacarte'
      ? htmlRow('Modules', esc(data.modulesChoisis.length ? data.modulesChoisis.join(', ') : 'Base seule'), 170)
      : htmlRow('Formule', esc(data.formule) || 'Non précisé', 170),
  ];
  if (data.tarifMode === 'alacarte') {
    tarifRows.push(htmlRow('Total estimé', `<strong>${data.totalEstime}&nbsp;€</strong>`, 170));
  }
  if (data.estimationStatus === 'custom') {
    tarifRows.push(htmlRow('Hors estimation', esc(data.estimationReasons.join(' ')), 170));
  }
  tarifRows.push(htmlRow('Maintenance', esc(data.maintenance) || 'Non précisé', 170));
  tarifRows.push(htmlRow('Domaine', esc(domaineLabel) + (data.domaineNom ? ' - ' + esc(data.domaineNom) : ''), 170));

  const contenuRows = [
    htmlRow('Sections', esc(data.sections.length ? data.sections.join(', ') : 'Non précisé'), 170),
    htmlRow('Photos', (esc(data.photos) || 'Non précisé') + (data.photosNb ? ' - ' + esc(data.photosNb) : ''), 170),
    htmlRow('Vidéos', esc(data.videos) || 'Non précisé', 170),
    htmlRow('Logo', esc(data.logo) || 'Non précisé', 170),
    htmlRow('Textes', esc(data.textes) || 'Non précisé', 170),
    htmlRow('Facebook', htmlLink(data.fbLink) || 'Aucun', 170),
    htmlRow('Instagram', htmlLink(data.igLink) || 'Aucun', 170),
    htmlRow('YouTube', htmlLink(data.ytLink) || 'Aucun', 170),
    htmlRow('Autre lien', htmlLink(data.autreLink) || 'Aucun', 170),
  ];

  const designRows = [
    htmlRow('Style', esc(data.style) || 'Non précisé', 170),
    htmlRow('Couleur principale', colorChip(data.couleur1), 170),
    htmlRow('Couleur secondaire', colorChip(data.couleur2), 170),
    htmlRow('Précisions couleurs', esc(data.couleursTexte) || 'Aucune', 170),
    htmlRow('Références', esc(data.refs) || 'Aucune', 170),
    htmlRow('À éviter', esc(data.refNon) || 'Aucun', 170),
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
        ${htmlSection('Infos complémentaires', [htmlRow('Message', escMultiline(data.infos) || 'Aucune', 170)])}
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
  const briefJsonBase64 = toBase64(JSON.stringify(data, null, 2));

  try {
    const brevoRes = await sendBrevoEmail(env, {
      to: 'contact@abiweb.fr',
      replyTo: data.email,
      subject: `Brief AbiWeb - ${data.nom} (${tarifLabel})`,
      textContent: text,
      htmlContent: html,
      attachment: [{ content: briefJsonBase64, name: 'brief.txt' }],
    });

    if (!brevoRes.ok) {
      const detail = await brevoRes.text();
      console.error('Brevo error:', detail);
      return json({ error: 'send_failed' }, 502);
    }

    await continueInBackground(ctx, (async () => {
      try {
        const attributes = {
          PRENOM: data.contact,
          NOM: `${data.nom} - ${tarifLabel}`,
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

      if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
        try {
          const supabaseRes = await fetch(`${env.SUPABASE_URL}/rest/v1/briefs`, {
            method: 'POST',
            signal: AbortSignal.timeout(8_000),
            headers: {
              apikey: env.SUPABASE_ANON_KEY,
              Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
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
            const detail = await supabaseRes.text();
            console.error('Supabase insert failed:', detail);
            // Le lead est déjà bien arrivé par email à ce stade - on alerte juste que
            // l'enregistrement Supabase (dossier structuré) n'a pas été sauvegardé.
            await sendFailureAlert(env, `Supabase insert (send-brief) - ${data.nom}`, detail);
          }
        } catch (err) {
          console.error('Supabase insert error:', err);
          await sendFailureAlert(env, `Supabase insert (send-brief) - ${data.nom}`, err && err.message ? err.message : err);
        }
      }
    })());

    return json({ ok: true });
  } catch (err) {
    console.error('Server error:', err);
    await continueInBackground(ctx, sendFailureAlert(env, 'send-brief - erreur serveur inattendue', err && err.message ? err.message : err));
    return json({ error: 'server_error' }, 500);
  }
}
