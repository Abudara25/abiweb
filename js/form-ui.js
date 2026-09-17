// Utilitaires partages par les deux parcours de demande.
export function applyFieldLimits(fields, limits) {
  for (const [key, id] of Object.entries(fields)) {
    const field = document.getElementById(id);
    if (!field || !limits[key]) continue;
    field.maxLength = limits[key];
    if (field.tagName === 'TEXTAREA') {
      const counter = document.createElement('span');
      counter.className = 'field-counter';
      counter.id = `${id}-counter`;
      const update = () => { counter.textContent = `${field.value.length} / ${limits[key]} caractères`; };
      field.insertAdjacentElement('afterend', counter);
      field.setAttribute('aria-describedby', [field.getAttribute('aria-describedby'), counter.id].filter(Boolean).join(' '));
      field.addEventListener('input', update);
      update();
    }
  }
}

export function setFieldError(field, invalid) {
  const group = field.closest('.form-group');
  group?.classList.toggle('has-error', invalid);
  field.setAttribute('aria-invalid', String(invalid));
  let error = group?.querySelector('.field-error');
  if (invalid && group && !error) {
    error = document.createElement('span');
    error.className = 'field-error';
    error.textContent = field.validationMessage || 'Vérifiez la valeur et la longueur de ce champ.';
    group.appendChild(error);
  }
  if (error) {
    error.id ||= `${field.id}-error`;
    const descriptions = new Set((field.getAttribute('aria-describedby') || '').split(' ').filter(Boolean));
    descriptions.add(error.id);
    field.setAttribute('aria-describedby', [...descriptions].join(' '));
  }
  return invalid;
}

export function createSubmissionState(newId = () => window.crypto.randomUUID()) {
  let fingerprint;
  let submissionId;
  return {
    prepare(data) {
      // Le jeton anti-bot change a chaque essai ; le projet, lui, reste identique.
      const content = { ...data };
      delete content.turnstileToken;
      delete content.ts;
      delete content.submissionId;
      const current = JSON.stringify(content);
      if (current !== fingerprint) {
        fingerprint = current;
        submissionId = newId();
      }
      return { ...data, submissionId };
    },
    reset() { fingerprint = undefined; submissionId = undefined; },
  };
}

export async function postForm(url, data) {
  const controller = new window.AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error(response.status === 429 ? 'rate_limited' : 'send_failed');
      error.status = response.status;
      throw error;
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export function formErrorMessage(error) {
  if (error.message === 'rate_limited') return 'Trop d’envois en peu de temps. Patientez quelques minutes, ou contactez-moi par email.';
  if (error.name === 'AbortError') return 'Le serveur met trop de temps à répondre. Votre saisie est conservée ; vous pouvez réessayer.';
  return 'L’envoi automatique a échoué. Votre saisie est conservée. Réessayez, ou contactez-moi directement par email.';
}
