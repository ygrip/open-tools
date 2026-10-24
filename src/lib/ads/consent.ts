import { writable } from 'svelte/store';

// No stored opt-in: the site's CMP owns consent and must supply it each visit.
export const advertisingConsent = writable(false);

declare global {
  interface Window {
    trickItAds?: { setConsent: (granted: boolean) => void };
  }
}

/** Bridge an existing CMP, not a consent dialog or a substitute for one. */
export function installAdvertisingConsentBridge(): () => void {
  const bridge = Object.freeze({
    setConsent(granted: boolean) { advertisingConsent.set(granted === true); }
  });
  window.trickItAds = bridge;
  window.dispatchEvent(new Event('trick-it:ads-ready'));
  return () => {
    advertisingConsent.set(false);
    if (window.trickItAds === bridge) delete window.trickItAds;
  };
}
