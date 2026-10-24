import { get } from 'svelte/store';
import { advertisingConsent } from './consent';

const scriptId = 'trick-it-adsense';
let library: Promise<void> | undefined;
let publisher: string | undefined;
const requested = new WeakSet<HTMLElement>();

declare global {
  interface Window {
    adsbygoogle?: { push: (request: Record<string, never>) => unknown };
  }
}

/** Load once per document. A failed load can be retried by a later page visit. */
function loadLibrary(client: string): Promise<void> {
  if (publisher && publisher !== client) return Promise.reject(new Error('AdSense publisher cannot change within a document'));
  if (library) return library;
  publisher = client;
  library = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    const timeout = setTimeout(failed, 15_000);
    function cleanup() {
      clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
    }
    function failed() {
      cleanup();
      script.remove();
      library = undefined;
      publisher = undefined;
      reject(new Error('AdSense library was blocked, timed out, or failed to load'));
    }
    script.onload = () => { cleanup(); resolve(); };
    script.onerror = failed;
    document.head.append(script);
  });
  return library;
}

/** Consent and visibility are checked again after the asynchronous SDK load. */
export function canRequestAd(element: HTMLElement): boolean {
  if (!get(advertisingConsent) || !element.isConnected || element.clientWidth <= 0) return false;
  return element.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) ?? getComputedStyle(element).visibility === 'visible';
}

/** Request only for a connected, visible new element, never refresh an old ad. */
export async function requestAd(element: HTMLElement, client: string): Promise<boolean> {
  if (requested.has(element)) return true;
  if (!canRequestAd(element)) return false;
  await loadLibrary(client);
  if (!canRequestAd(element)) return false;
  if (requested.has(element)) return true;
  const queue = window.adsbygoogle ??= new Array<Record<string, never>>();
  queue.push({});
  requested.add(element);
  return true;
}
