# Isolated tool runtime

Use this guide after [creating a standalone tool](scaffold-tool.md). [Contract v3](tool-contract-v3.md) declares presentation, guides, permission reasons and immutable resource descriptors. The platform display name is `trick-it`; GitHub provenance URLs and the established theme bridge keep their existing identities.

## Start with no extra authority

The iframe remains `sandbox="allow-scripts"`, with an opaque origin. Never add `allow-same-origin`. It cannot read the platform DOM, cookies or storage and cannot fetch arbitrary network URLs. The host installs `window.trickIt` before tool scripts run; it is the supported bridge for declared capabilities and assets, not an escape from isolation.

The SDK is available only when hosted. For standalone development, feature-detect it and disable hosted-only features rather than inventing an insecure network fallback. A self-contained local-only tool needs no capability prompt and can start immediately. A tool with declared capabilities shows the release guide, version, reasons and resource disclosure before approval. Optional features must work gracefully when declined.

## Tool-owned workspace layout

trick-it provides the responsive outer page width and an initial iframe height only. Once the verified HTML bundle is loaded, a host-installed resize observer inside the opaque sandbox reports its document's content height; the shell grows **and shrinks** with the tool. Users should scroll the page, not a separate fixed-height tool panel. This applies to v2 and v3 bundles without changing their manifests or adding permissions.

Design tools with fluid width (`width: 100%` and `min-width: 0` for flexible/grid children) and natural document height. Avoid `height: 100vh`, `max-height: 100vh`, full-screen fixed/absolute shells, and `overflow-y: auto` on an entire tool workspace: viewport-relative height creates resize feedback and can reintroduce a nested scrollbar. Intentional bounded scroll areas, such as text editors or wide data tables, can still scroll independently.

The resize bridge is **host-managed**. Tools do not need to post sizing messages themselves and cannot access or manipulate the parent document. Changing visible content, translated copy, or responsive layout should naturally trigger a height update; avoid polling or reloading the frame to resize it. Very large heights are bounded to prevent a broken or malicious tool from creating an unbounded page.

## Locale and theme without losing work

The host initializes `html.lang` and `html[data-theme]` before parsing the tool's own script. Declare actual UI support with `locales: ["en", "id"]`; omitted `locales` means English only. Platform/guide translations are independent from tool interface support. Unsupported interface locales use the tool's first declared language, while platform navigation stays in the selected language. Consume the root `--ot-*` color tokens. Listen for locale changes to update **labels**, not to recreate the editor:

```js
const labels = {
  en: { run: 'Run', input: 'Input' },
  id: { run: 'Jalankan', input: 'Input' }
};
function translate() {
  const locale = window.trickIt?.locale ?? document.documentElement.lang;
  const text = labels[locale] ?? labels.en;
  document.getElementById('run').textContent = text.run;
  document.querySelector('label[for="input"]').textContent = text.input;
}
translate();
addEventListener('trick-it:localechange', translate);
```

Theme updates require no custom receiver if styles use the host tokens. Do not read browser storage, introduce a competing preference, replace input values or reload the document on a locale/theme change. A v2 release without localized controls can still use the existing theme contract; metadata translations alone do not translate its operation UI.

## Request a sensitive operation

Declare the matching permission and its reason in the manifest first. Call the SDK only in response to a meaningful tool action. The host checks the calling frame, random session channel, request ID, declared capability and current grant, then presents its own confirmation. Arbitrary sibling frames cannot submit a valid request for this tool. Native browser permissions are separate and can still deny the operation.

Clipboard write accepts a **string**, not an object:

```js
async function copyResult() {
  if (!window.trickIt) return showError('Open this tool in trick-it to use Copy.');
  try {
    await window.trickIt.request('clipboard-write', document.getElementById('output').value);
    showStatus('Copied.');
  } catch {
    showError('Copy was not approved or is unavailable. Your result is still here.');
  }
}
```

The example's `showStatus`/`showError` are tool-owned text announcements: implement them with `textContent` and a live region, not untrusted HTML. Never log clipboard contents, precise location, private input or raw browser error objects.

Use `trickIt.request('services', { feature: 'audit', input: { url, strategy: 'mobile', locale: 'en' } })` for a declared [protected online feature](protected-services.md). The host manages the per-action confirmation and Turnstile token. The tool receives only the result; no secret, token or network access is granted. Deployment policy controls per-feature rates and verification.

Other supported broker operations:

```js
const text = await window.trickIt.request('clipboard-read');
const position = await window.trickIt.request('geolocation');
await window.trickIt.request('downloads', {
  filename: 'result.json',
  mime: 'application/json',
  bytes: new TextEncoder().encode('{"result":true}').buffer
});
```

Do not request these sequentially at startup; the snippet only documents their payloads. Clipboard text is capped at 1 MiB. Downloads are capped at 16 MiB, use a simple filename of at most 120 characters without path separators, and accept the supported MIME types `text/plain`, `text/csv`, `text/html`, `application/json`, `application/octet-stream`, `application/pdf` and `image/png`. Downloads never accept arbitrary remote URLs. Location results contain only the host's bounded position data; do not assume a native `GeolocationPosition` object crosses the bridge.

User cancellation, denial, an unsupported API, an insecure context, a concurrent request, revocation or navigation can reject a promise. Catch failures, announce a friendly explanation and preserve user work. The host does not display raw exception details or pretend that platform approval overrides browser/OS policy. Camera/microphone and direct network access are not supported capabilities.

## Load a pinned model only when needed

Declare `external-assets` and any relevant `wasm`/`workers` policy capability, provide the resource's exact byte count/SHA-256, and have the registry owner approve its HTTPS origin. Use `defer: true` for a model the user may never need.

```js
async function initializeModel() {
  if (!window.trickIt) throw new Error('Hosted model loading is unavailable.');
  showStatus('Loading the optional model…');
  try {
    const resource = await window.trickIt.asset('model');
    if (resource.type !== 'wasm') throw new Error('Unexpected resource type');
    const { instance } = await WebAssembly.instantiate(resource.bytes, {});
    showStatus('Model ready.');
    return instance;
  } catch {
    showError('The model could not load or permission was declined. You can retry without losing input.');
    return null;
  }
}
```

The host resolves only a declared ID, not a caller-supplied URL. It sends public CORS requests without credentials/referrer, rejects redirects, limits the byte stream and verifies SHA-256 before handing an `ArrayBuffer` to the iframe. Cached bytes are reverified too; corrupt cache entries cannot bypass integrity checks. Version/hash-based cache keys avoid reusing changed releases. Cache-storage failure should be surfaced as an offline-cache warning while still allowing already verified bytes to run.

The host never instantiates this WASM or evaluates an external script. The isolated tool controls use of the verified bytes. `wasm` enables the appropriate conditional CSP capability; browser support may still be absent. For declared `script` assets, review and decode bytes only inside the tool; with `external-assets` granted, a tool-owned blob module import is allowed. Keep extra modules self-contained, or explicitly adapt dependencies through separately declared assets—relative/CDN imports are not automatically permitted. JavaScript `eval`/`new Function` remain blocked. Worker code has no window SDK: load verified resources in the tool frame and pass their buffers into the worker. Single-thread WASM and ordinary blob workers are supported; do not assume SharedArrayBuffer or cross-origin-isolated ML runtimes are available. For a declared worker asset, create a tool-owned blob URL from the verified bytes:

```js
const resource = await window.trickIt.asset('inference-worker');
if (resource.type !== 'worker') throw new Error('Unexpected resource type');
const url = URL.createObjectURL(new Blob([resource.bytes], { type: 'text/javascript' }));
const worker = new Worker(url);
// Transfer separately verified model/data buffers to the worker as needed.
// When finished or leaving this operation:
worker.terminate();
URL.revokeObjectURL(url);
```

This is a lifecycle sketch, not a complete inference loop. Do not terminate a worker before completing its work. Catch startup errors and revoke its blob URL on failure as well. Workers do not get a free network exception: package their code/dependencies and explicitly transfer verified model bytes from the tool. Neither workers nor an opaque iframe guarantee protection from excessive CPU or memory use; enforce input limits and terminate abandoned jobs.

Automatic assets (`defer: false`) can delay launch while verified downloads complete. The host displays loading/error/retry states; optional declined capabilities must not cause speculative downloads. Explain approximate download size and offline limitations in the tool's user guide. Browser cache quotas and eviction mean a prior download is not a promise of permanent offline availability.

## Consent, revocation and updates

Grants belong to the active tool session and release; they are not blanket permanent browser permissions. The user can revoke the runtime, which destroys its iframe and aborts pending work/requests. Store important output only through deliberate user actions. Never send user data to the parent for logging or analytics.

The host checks the release JSON identity and bootstrap HTML digest before embedding. A release/version mismatch, unsupported runtime, invalid digest, oversized resource or missing grant fails closed with a retry/recovery path. The platform's PWA update flow must ask before reloading an active workspace. A user's approval to download a model is not permission to silently replace it with bytes from a mutable URL.

For every release, test accepted and declined permissions, browser-native denial, revocation during a request, cache corruption, offline startup, optional model failure, mobile focus behavior, and preservation of input/output during language/theme changes. No live private GitHub or model endpoint is considered verified solely because a mocked test passes.
