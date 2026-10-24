# Optional AdSense advertising

Advertising is **disabled by default**. `config/ads.json` is public, build-time host configuration, not a tool manifest or a runtime secret. Changing it requires a rebuild and deployment. No publisher ID is preselected.

## Configuration

```json
{
  "enabled": false,
  "client": "ca-pub-5501931731194817",
  "testMode": true,
  "placements": {
    "home": "",
    "tool": ""
  },
  "frameOrigins": []
}
```

- `enabled`: master switch. When false, no ad markup, SDK requests, or additional CSP origins are enabled. When true and at least one slot is configured, the host automatically renders configured placements and loads the AdSense SDK; this project has no visitor opt-in gate or integrated CMP.
- `client`: the AdSense **publisher** ID, in `ca-pub-` format. This public identifier is not a credential.
- `placements.home` / `placements.tool`: responsive **ad-unit slot IDs** copied from AdSense, not the publisher ID. An empty string disables that placement. Home ads appear below the explanatory content; tool ads appear below the workspace and isolation note, away from upload/download/zoom controls. Legal and error pages have no placements.
- `testMode`: defaults to true and adds `data-adtest="on"`. Turn it off only for an approved production rollout. Test ads still make third-party requests; never click your own ads.
- `frameOrigins`: explicit HTTPS origins the host may use for ad frames. Enabling ads requires a nonempty allowlist. Exact origins and scoped wildcards such as `https://*.safeframe.googlesyndication.com` are accepted; unrestricted wildcards, HTTP, paths, credentials and arbitrary CSP directives are rejected.

Google does not publish a permanent minimal AdSense frame-origin list. Review [Google's CSP guidance](https://support.google.com/adsense/answer/16283098) and use browser CSP violations to identify required origins for your actual configuration. Commonly encountered origins include `https://googleads.g.doubleclick.net` and `https://tpc.googlesyndication.com`; these examples are **not a complete or guaranteed allowlist**. Keep the policy narrow rather than permitting all HTTPS frames.

Only the parent host's `frame-src` policy changes. This policy is document-wide, not scoped to ad elements: enabling additional origins is an explicit additional trust choice for frame destinations. Opaque tool iframes keep their restrictive CSP, `sandbox="allow-scripts"`, and existing permission checks; they do not gain same-origin DOM access. Ad configuration is never inserted into tool bundles.

## Consent and legal requirements

This project does **not** show a consent dialog, delay ad requests for visitor consent, persist consent, or integrate a consent-management platform (CMP). When `enabled` is true, configured slots and the AdSense SDK load automatically. The Privacy Policy and Terms disclose advertising; reading or continuing to use the site is **not** treated by this project as consent to cookies or personalized advertising.

The operator is responsible for determining applicable law and Google requirements before enabling ads. Where prior consent is required, configure an appropriate CMP or other compliant provider integration to obtain it and control ad requests and Google's consent signals before deploying this automatic ad integration in those contexts. Google requires a Google-certified CMP integrated with the IAB TCF for personalized ads served in the EEA, UK and Switzerland. This PR does not implement or certify a CMP, and the legal notices do not replace one. See [Google's CMP requirements](https://support.google.com/adsense/answer/13554116) and [request-pausing guidance](https://support.google.com/adsense/answer/7670312). Non-personalized ads are not necessarily cookie-free or consent-exempt. Obtain appropriate legal advice for the sites and audiences you serve.

## Account and placement setup

1. Confirm `readynaz.com` is approved in AdSense and use the intended publisher account. `tools.readynaz.com` generally belongs to the existing root-domain site entry.
2. Check the publisher seller line at `https://readynaz.com/ads.txt`. The same publisher and seller normally need no separate subdomain ads.txt; a different publisher/seller requires reviewing [Google's subdomain guidance](https://support.google.com/adsense/answer/9785052). This repository does not modify the root-domain file.
3. Create responsive display units and paste their slot IDs into the desired placements. Keep Auto ads **off** for these pages to avoid uncontrolled or duplicate placements; this implementation manages manual units only.
4. Review the Privacy Policy and Terms, configure any CMP/provider integration required for your jurisdictions, and add only the required host frame origins.
5. Set `enabled: true` and build. Test mobile/desktop placement, the applicable consent experience and provider signals, SPA tool navigation, ad blocking, and CSP violations. Set `testMode: false` only after account/policy checks and successful integration testing.

The SDK is loaded once in the parent document's head when an enabled, configured placement initializes. Each new measurable ad element is requested once; SPA navigation does not refresh an already processed element. Empty slots stay absent and space is reserved for configured visible ads. Provider-controlled responsive height can still vary; inspect real ads for layout shifts. Ad blockers, timeouts, and provider failures do not gate tool startup. The service worker does not cache third-party ad traffic.

English and Indonesian Privacy Policy and Terms disclose optional host advertising and third-party data processing. The Tool Policy explains that ads stay outside isolated tool frames and do not grant tools additional permissions. Other legal locales currently use the existing English fallback.

## Verification

```sh
node --test tests/ads.test.mjs
npm run check
# After building:
npx playwright test tests/browser/ads.spec.ts
```

Browser tests use a mocked SDK and test-only configuration. They must not fetch real ads or generate impressions. Passing these tests does not establish Google approval, legal compliance, real CMP integration, or complete provider-origin coverage.
