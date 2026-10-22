/**
 * Only the catalog is safe to refresh automatically. Tools can contain unsaved
 * input, so their users must approve a release change explicitly.
 *
 * @param {string} pathname
 * @param {string} base
 * @param {boolean} busyWithInput Whether a field or modal is active.
 */
export function canAutoRefreshCatalog(pathname, base = '', busyWithInput = false) {
  return !busyWithInput && (pathname === `${base}/` || pathname === `${base}/id/`);
}

/**
 * Download the current release, then activate it only after the new offline shell
 * has installed. A caller may reload once this resolves. Never clear existing
 * caches first: they are the fallback if the new download fails.
 *
 * @param {ServiceWorker} worker
 * @param {(state: ServiceWorkerState) => boolean} completed
 * @param {number} timeoutMs
 * @param {() => void} [start]
 */
function waitForState(worker, completed, timeoutMs, start) {
  return new Promise((resolve, reject) => {
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timer;
    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      worker.removeEventListener('statechange', check);
    };
    const check = () => {
      if (worker.state === 'redundant') {
        cleanup();
        reject(new Error('The replacement service worker could not install.'));
      } else if (completed(worker.state)) {
        cleanup();
        resolve(undefined);
      }
    };
    worker.addEventListener('statechange', check);
    timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out preparing the PWA update.'));
    }, timeoutMs);
    if (worker.state === 'redundant' || completed(worker.state)) {
      check();
      return;
    }
    if (start) {
      try { start(); }
      catch (error) { cleanup(); reject(error); }
    }
    check();
  });
}

/**
 * @param {ServiceWorkerRegistration} registration
 * @param {{
 *   installTimeoutMs?: number,
 *   activationTimeoutMs?: number,
 *   onPhase?: (phase: 'checking' | 'downloading' | 'activating' | 'ready') => void
 * }} [options]
 */
export async function applyPwaUpdate(registration, options = {}) {
  options.onPhase?.('checking');
  // A worker may already be installing in the background; don't start a
  // redundant network update check while the user is waiting for that worker.
  if (!registration.waiting && !registration.installing) await registration.update();

  const installing = registration.installing;
  if (installing && !registration.waiting) {
    options.onPhase?.('downloading');
    await waitForState(installing, (state) =>
      state === 'installed' || state === 'activating' || state === 'activated',
      options.installTimeoutMs ?? 120_000
    );
  }

  // In some browsers registration.waiting updates a tick after statechange.
  const waiting = registration.waiting || (installing?.state === 'installed' ? installing : null);
  if (waiting) {
    options.onPhase?.('activating');
    await waitForState(waiting, (state) => state === 'activated',
      options.activationTimeoutMs ?? 30_000,
      () => waiting.postMessage({ type: 'trick-it:activate', version: 1 })
    );
    options.onPhase?.('ready');
    return;
  }

  if (installing?.state === 'activating') {
    options.onPhase?.('activating');
    await waitForState(installing, (state) => state === 'activated', options.activationTimeoutMs ?? 30_000);
  }
  // No replacement worker: a SPA-only release can be picked up on reload.
  options.onPhase?.('ready');
}
