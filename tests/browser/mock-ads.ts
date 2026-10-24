import type { BrowserContext } from '@playwright/test';

/** Exercise host ad layout without contacting Google or generating impressions. */
export const mockAdSenseSdk = `window.__adRequests = [];
window.adsbygoogle = { push() {
  const ad = document.querySelector('ins.adsbygoogle:not([data-adsbygoogle-status])');
  if (!ad) throw new Error('Duplicate ad request');
  ad.setAttribute('data-adsbygoogle-status', 'done');
  const frame = document.createElement('iframe');
  frame.title = 'Advertisement';
  frame.style.cssText = 'display:block;width:100%;height:250px;border:0';
  frame.srcdoc = '<!doctype html><html lang="en"><head><title>Test advertisement</title></head><body><p>Test advertisement</p></body></html>';
  ad.append(frame);
  window.__adRequests.push(ad.getAttribute('data-ad-slot'));
} };`;

export async function mockAdvertising(context: BrowserContext): Promise<void> {
  // Defense in depth: never allow provider requests to escape a browser test.
  await context.route(/^https:\/\/(?:[a-z0-9-]+\.)*(?:googlesyndication\.com|doubleclick\.net|googleadservices\.com|adtrafficquality\.google)(?:\/|$)/, route => route.abort('blockedbyclient'));
  // Last registered matching context route wins. Page-specific SDK routes can
  // still simulate blocked loads and delayed responses in advertising tests.
  await context.route('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js*', route =>
    route.fulfill({ contentType: 'text/javascript', body: mockAdSenseSdk }));
}
