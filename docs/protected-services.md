# Protected online tool features

trick-it keeps browser-only tools isolated and local. Reviewed tools can opt into host-managed Worker services for features that need a remote API. Protection is configured per feature in the standalone tool's v3 manifest:

```json
{
  "permissions": [{
    "name": "services",
    "reason": "Audit the public URL you approve using Google PageSpeed Insights.",
    "required": true
  }],
  "services": [{
    "id": "audit",
    "handler": "pagespeed-seo",
    "rateLimit": { "limit": 5, "periodSeconds": 60 },
    "turnstile": true
  }]
}
```

The service list is optional; existing local tools need no changes. Each feature has its own rate-limit bucket. Two features can use different limits and Turnstile settings. Only approved immutable registrations determine deployed policies. A browser cannot disable Turnstile, raise a limit or choose a different provider URL. This release supports only the host-owned `pagespeed-seo` handler. Other server behaviors require reviewed implementations before the schema allows them.

## Runtime

The isolated tool calls:

```js
const report = await window.trickIt.request('services', {
  feature: 'audit',
  input: { url: 'https://example.com/', strategy: 'mobile', locale: 'en' }
});
```

The tool needs the session's `services` grant. Trick-it displays an action confirmation with the URL and configured request allowance. When required, its host-owned Turnstile widget must produce a fresh token before approval is enabled. The token never enters the tool iframe. Denial, revocation, challenge failure/expiry and retries preserve tool input. Each new attempt mounts a new widget/token. Script loading is lazy; local-only tools do not load Turnstile or call a service.

After approval, the host POSTs `{version, sha256, input, turnstileToken}` to `/api/tools/<tool-id>/<feature-id>`. The Worker checks the deployed version and bundle digest, validates input, applies an attempt throttle, verifies the Turnstile token server-side, applies the feature limit, and invokes the fixed handler. Turnstile validation requires `success === true`, the generated feature-specific action and an explicitly allowed frontend hostname. Cloudflare rejects expired or reused tokens; no client flag bypass exists. The action-scoped token is not an account login or authorization credential.

`GET /api/tools/<tool-id>/<feature-id>/config?version=…&sha256=…` exposes the public sitekey and feature action for the current deployed release only. It exposes no secret. Missing sitekey/secret/hostname configuration or rate-limit bindings fails closed. API responses are `no-store`; PWA POST caching is not used. The old unprotected `/api/seo-audit` endpoint is not routed.

## Configuration and deployment

Accepted limits: 1–60 requests per 10 or 60 seconds. These use Cloudflare's native per-location counters, keyed by feature and visitor IP; they are approximate and shared-IP users share a bucket. They are not exact global or daily provider quotas. Set Google API project quotas separately. Local JavaScript cannot be made tamper-proof with these rate limits: they protect only Worker-backed actions.

`npm run services:generate` compiles normalized catalog metadata into ignored build outputs `worker/generated-services.json` and `.wrangler.services.json`. These are generated for verification/deployment and are never committed. The latter extends the base `wrangler.jsonc` with a native binding for every feature. Binding/action names are deterministic hashes of the tool and feature; rate limits come from the approved manifest. `npm run build` runs registry sync and policy generation together. Change a tool policy by releasing its manifest and updating its pinned registration, then rebuild/redeploy.

The verification artifact includes the exact static `build/`, Worker source/policy and generated Wrangler configuration. Deployment downloads that artifact to the repository root and runs:

```sh
npx wrangler deploy --config .wrangler.services.json
```

Do not deploy only static assets or run the base config when services are enabled; the generated per-feature bindings are required. Use `npx wrangler deploy --config .wrangler.services.json --dry-run` before publication. The base config declares `SERVICE_ATTEMPT_LIMITER` (20 attempts/60 seconds), the public `TURNSTILE_SITE_KEY`, and `TURNSTILE_HOSTNAMES`. The sitekey is a public widget identifier intended for browser use and safe to commit; it cannot validate tokens. Only the separate Worker secret can do that. The generated feature bindings share the same account, so review namespace use before combining external deployments. Keys include the tool/feature to keep counters independent.

`TURNSTILE_SECRET` is an existing Worker secret. It must never enter source, the public tool schema, frontend variables, generated config or logs. The setup created a managed widget for `tools.readynaz.com`, `localhost` and `127.0.0.1`, and stored its secret directly in the existing `trick-it` Worker. Production `TURNSTILE_HOSTNAMES` is **only** `tools.readynaz.com`; local development requires a separate ignored `.dev.vars` configuration or Cloudflare test credentials. Never allow local hostnames in production validation.

Google's optional `PAGESPEED_API_KEY` also belongs only in the Worker secret store. Keyless shared quota may be exhausted. Turnstile does not increase Google quota or guarantee provider availability.

## Verification

Tests cover malformed manifests, determinism, independent feature policies, denied/expired/replayed/mismatched tokens, absent deployment configuration, stale releases, fixed-provider dispatch, sandbox consent, token expiry and retries. Tool interface tests and tool-specific behavior documentation belong in each standalone tool repository. Unit/browser success uses explicit fixtures, not a production CAPTCHA bypass. A real fresh-token audit and token replay against the deployed Worker remain a separate deployment check; do not label mocked tests as live validation.
