# Optional AdSense advertising

Advertising is **disabled by default**. `config/ads.json` is public, build-time host configuration, not a tool manifest or a runtime secret. Changing it requires a rebuild and deployment. No publisher ID is preselected.

## Configuration

```json
{
  "enabled": false,
  "client": "ca-pub-5501931731194817",
  "testMode": true,
  "consentConfigured": false,
  "placements": {
    "home": "",
    "tool": ""
  },
  "frameOrigins": []
}
```

- `enabled`: master switch. When false, no ad markup, SDK requests, consent bridge, or additional CSP origins are enabled.
- `client`: the AdSense **publisher** ID, in `ca-pub-` format. This public identifier is not a credential. Confirm the example belongs to the account you intend to use.
- `placements.home` / `placements.tool`: responsive **ad-unit slot IDs** copied from AdSense, not the publisher ID. An empty string disables that placement. Home ads appear below the explanatory content; tool ads appear below the workspace and isolation note, away from upload/download/zoom controls. Legal and error pages have no placements.
- `testMode`: defaults to true and adds `data-adtest="on"`. Turn it off only for an approved production rollout. Test ads still make third-party requests; never click your own ads.
- `consentConfigured`: a deployment acknowledgement, **not visitor consent**. Enabling ads fails validation until this is true. Set it only after configuring and testing the applicable consent-management integration below.
- `frameOrigins`: explicit HTTPS origins the host may use for ad/consent frames. Enabling ads requires a nonempty allowlist. Exact origins and scoped wildcards such as `https://*.safeframe.googlesyndication.com` are accepted; unrestricted wildcards, HTTP, paths, credentials and arbitrary CSP directives are rejected.

Google does not publish a permanent minimal AdSense frame-origin list. Review [Google's CSP guidance](https://support.google.com/adsense/answer/16283098) and use browser CSP violations to identify required origins for your actual configuration. Commonly encountered origins include `https://googleads.g.doubleclick.net` and `https://tpc.googlesyndication.com`; these examples are **not a complete or guaranteed allowlist**. Keep the policy narrow rather than permitting all HTTPS frames. Consent-provider frames may need their own entries.

Only the parent host's `frame-src` policy changes. This policy is document-wide, not scoped to ad elements: enabling additional origins is an explicit additional trust choice for frame destinations. Opaque tool iframes keep their restrictive CSP, `sandbox="allow-scripts"`, and existing permission checks; they do not gain same-origin DOM access. Ad configuration is never inserted into tool bundles.

## Consent: required before any ad request

The integration starts **denied on every page load**. It does not load AdSense or render slots until your CMP explicitly grants advertising through:

```js
window.trickItAds?.setConsent(true);
```

Your CMP adapter must also call `setConsent(false)` on denial or withdrawal. Do not call `setConsent(true)` unconditionally from application code or infer consent from visiting a page. The bridge intentionally does not persist consent: your CMP owns the stored choice and its validity.

Install the adapter before or after hydration by checking for the bridge and listening for its readiness event:

```js
function connectAdvertisingConsent() {
  // Implement with your CMP's documented API:
  // 1. Apply Google's consent signals through the CMP BEFORE granting permission.
  // 2. Forward its current advertising permission to trickItAds.setConsent(...).
  // 3. Forward every subsequent change, including withdrawal; update Google too.
}

if (window.trickItAds) {
  connectAdvertisingConsent();
} else {
  window.addEventListener('trick-it:ads-ready', connectAdvertisingConsent, { once: true });
}
```

This is an integration outline, **not a working CMP implementation or a consent banner**. Connect your provider's actual API before enabling ads. Google requires a Google-certified CMP integrated with the IAB TCF for personalized ads served in the EEA, UK and Switzerland; Google's Privacy & messaging offering is one option. See [Google's requirements](https://support.google.com/adsense/answer/13554116) and [request-pausing guidance](https://support.google.com/adsense/answer/7670312). Non-personalized ads are not necessarily cookie-free or consent-exempt.

Withdrawing bridge consent removes ad elements and stops new slot requests. It cannot unload JavaScript already executed, cancel every in-flight third-party request, or delete provider cookies. Your CMP must update the provider's consent signals too; verify withdrawal with the provider and browser network/storage tools. Tools remain usable when advertising is denied, blocked or offline.

## Account and placement setup

1. Confirm `readynaz.com` is approved in AdSense and use the intended publisher account. `tools.readynaz.com` generally belongs to the existing root-domain site entry.
2. Check the publisher seller line at `https://readynaz.com/ads.txt`. The same publisher and seller normally need no separate subdomain ads.txt; a different publisher/seller requires reviewing [Google's subdomain guidance](https://support.google.com/adsense/answer/9785052). This repository does not modify the root-domain file.
3. Create responsive display units and paste their slot IDs into the desired placements. Keep Auto ads **off** for these pages to avoid uncontrolled or duplicate placements; this implementation manages manual units only.
4. Configure the certified CMP where applicable, its bridge adapter, privacy disclosures, and required host frame origins. Only then set `consentConfigured: true` and `enabled: true`, keeping test mode on first.
5. Build and test mobile/desktop placement, actual consent grant/denial/withdrawal, SPA tool navigation, ad blocking, and CSP violations. Set `testMode: false` only after account/policy checks and successful integration testing.

The SDK is loaded once in the parent document's head after consent. Each new measurable ad element is requested once; SPA navigation does not refresh an already processed element. Empty slots stay absent and space is reserved for configured visible ads. Provider-controlled responsive height can still vary; inspect real ads for layout shifts. Ad blockers, timeouts, and provider failures do not gate tool startup. The service worker does not cache third-party ad traffic.

English and Indonesian privacy and tool-policy pages disclose optional host advertising, provider data processing, consent requirements, and the separation from tool permissions. Other legal locales currently use the existing English fallback.

## Verification

```sh
node --test tests/ads.test.mjs
npm run check
# After building:
npx playwright test tests/browser/ads.spec.ts
```

Browser tests use a mocked SDK and test-only configuration. They must not fetch real ads or generate impressions. Passing these tests does not establish Google approval, legal compliance, real CMP integration, or complete provider-origin coverage.
