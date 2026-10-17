export type ErrorPresentation = {
  eyebrow: string;
  title: string;
  description: string;
  illustration: '404' | '500';
  illustrationAlt: string;
  retry: boolean;
};

const missing: ErrorPresentation = {
  eyebrow: 'A small detour', title: 'This little path leads nowhere.',
  description: 'We looked in all the drawers. That page may have moved, or the link needs a tiny fix. Your next helper is back in the toolbox.',
  illustration: '404', illustrationAlt: 'A curious clay toolbox searches a map with a magnifying glass.', retry: false
};
const paused: ErrorPresentation = {
  eyebrow: 'A little pause', title: 'Even little tools need a tune-up.',
  description: 'Something on our side didn’t go as planned. Give it another try, or head back to the toolbox while we sort things out.',
  illustration: '500', illustrationAlt: 'A cheerful clay toolbox takes a repair break with a wrench and soft mint gear.', retry: true
};

export function errorPresentation(status: number): ErrorPresentation {
  if (status === 404) return missing;
  if (status === 403 || status === 401) return { ...missing, eyebrow: 'A closed drawer', title: 'This drawer isn’t open just yet.', description: 'You don’t have access to this page. The public toolbox is still open and ready to help.' };
  if (status === 429) return { ...paused, eyebrow: 'One small breather', title: 'A few too many little requests.', description: 'We need a moment to catch up. Please wait a little before trying again.' };
  if (status === 503) return { ...paused, eyebrow: 'Back after a small tune-up', title: 'The toolbox is taking a short break.', description: 'This service isn’t available right now. Try again in a moment, or come back after a short break.' };
  if (status >= 500) return paused;
  return { ...missing, eyebrow: 'A small snag', title: 'We couldn’t open that page.', description: 'That request didn’t quite work. Try a different link, or find your next little helper in the toolbox.' };
}

/** Public errors carry a reference, never a raw exception or credential-bearing message. */
export function reportUnexpectedError(error: unknown, status: number, source: 'client' | 'server'): App.Error {
  // Missing routes and other expected request errors are not server incidents.
  if (status >= 400 && status < 500) return { message: errorPresentation(status).title };
  const incidentId = crypto.randomUUID();
  const kinds = new Set(['Error', 'TypeError', 'ReferenceError', 'RangeError', 'SyntaxError', 'URIError', 'EvalError']);
  let kind = 'UnknownError';
  try {
    // Read once: arbitrary Error subclasses may have stateful or throwing getters.
    const name = error instanceof Error ? error.name : undefined;
    if (typeof name === 'string' && kinds.has(name)) kind = name;
  } catch { kind = 'UnknownError'; }
  // Keep diagnostics intentionally narrow: exception messages/objects can contain user data or secrets.
  console.error('[trick-it] unexpected error', { incidentId, status, source, kind });
  return { message: 'Something on our side didn’t go as planned. Please try again.', incidentId };
}
