# Isolated tool runtime

Use this guide after [creating a standalone tool](scaffold-tool.md). [Contract v3](tool-contract-v3.md) declares presentation, guides, permission reasons and immutable resource descriptors. The platform display name is `trick-it`; GitHub provenance URLs and the established theme bridge keep their existing identities.

## Start with no extra authority

The iframe remains `sandbox="allow-scripts"`, with an opaque origin. Never add `allow-same-origin`. It cannot read the platform DOM, cookies or storage and cannot fetch arbitrary network URLs. The host installs `window.trickIt` before tool scripts run; it is the supported bridge for declared capabilities and assets, not an escape from isolation.

The SDK is available only when hosted. For standalone development, feature-detect it and disable hosted-only features rather than inventing an insecure network fallback. Tools start immediately. Only **startup** permissions (`wasm`, `workers`, `external-assets`) change the sandbox policy, so a tool declaring them shows one host popup with reasons and resource disclosure before launch. **Runtime** permissions (clipboard, downloads, location, camera, share) are asked the first time the tool uses them. Every answer is remembered per tool in the user's browser and is not asked again; **Reset access** in the tool bar clears it. Optional features must work gracefully when declined.

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

## Shared clay UI (`trickIt.ui`)

The host injects a small claymorphism kit into every sandbox. It needs no permission, uses the `--ot-*` tokens and `ti-` class prefix (restyle freely), follows the host language, and respects reduced motion. **Use it for every applicable hosted interaction; hand-rolled equivalents are not release-compliant.** This applies to new scaffolds and existing-tool migrations. Follow the [shared-UI release gate](tool-ui-checklist.md): replace competing implementations in the tool repository, retain only API-absence fallbacks, and prove the rendered behavior with tests before pushing. Domain-specific editors/results and persistent input validation remain tool-owned.

```js
const { ui } = window.trickIt;

// Shared file picker: click or drag-and-drop, local previews, validated before onChange.
const picker = ui.fileInput('#drop', {
  label: 'Drop a photo',              // optional; localized default
  hint: 'PNG or JPEG, up to 12 MB',   // optional; generated from accept/maxBytes
  accept: ['image/png', 'image/jpeg', '.webp'], // MIME, wildcard (image/*) or extension
  maxBytes: 12 * 1024 * 1024,
  multiple: false, maxFiles: 1,       // multiple: true allows up to maxFiles
  onChange(files) { load(files[0]); },
  onError(message) {}                 // already shown inline
});
picker.clear(); picker.setDisabled(true); picker.setError('Could not read this file.');

// Inline status card: waiting → working (optional %) → done / error.
const job = ui.status('#result', { state: 'waiting', title: 'Ready when you are' });
job.work('Compressing…', '3 of 8 images', 37.5);
job.done('All done', 'Saved 1.2 MB');      // or job.fail('Could not finish', reason)

// Host-rendered, centred in the real viewport and labelled "From <tool>".
await ui.toast('Copied to clipboard', { tone: 'success' }); // info | success | error
await ui.info({ title: 'How it works', items: ['Pick a file', 'Download the ZIP'], ordered: true });
if (await ui.confirm({ title: 'Clear everything?', message: 'This cannot be undone.', confirmLabel: 'Clear', tone: 'danger' })) reset();
```

`picker.setDisabled(true)` locks native selection, drag-and-drop and selected-file removal together; re-enable after processing. Programmatic `.clear()` remains available for tool-owned reset. Disabling must not let removal change the dataset underneath an active job.

Finished status cards (done/error) show a close button. `job.dismiss()` hides a card (optionally call `onDismiss` passed in the options); the next state change shows it again, so reuse one card per place instead of creating a new `ui.status` on every update. Identical toasts (same text, tone and tool) replace each other instead of stacking, and every toast has a close button.

The shared picker, status card and close buttons defend their own layout and typography (15px base, centred column) against a tool's global `label`, `button`, `input`, `span` or `.settings label` rules, so every tool looks the same. Do not restyle them with structural overrides; change tokens (`--ot-*`) or the surrounding container only.

### Shared table and control pane

Use `ui.table(target, options)` for tabular data in standalone tools. It renders a responsive, horizontally scrollable table and a host-owned control pane with localized search, column visibility, ascending/descending sort, rows per page (10/25/50/100 by default), density and pagination. No server calls, third-party grid dependencies or extra permissions are needed. The table is injected into the isolated tool frame, uses the host theme, and never sends rows to the parent. UI remains navigable on narrow screens.

```js
const grid = trickIt.ui.table('#result', {
  caption: 'Generated records',
  columns: [{ key: 'name', label: 'Name' }, { key: 'score', label: 'Score', sortable: true }],
  rows: [{ name: 'Example', score: 12 }],
  pageSize: 10, pageSizes: [10, 25, 50, 100], // optional
  density: 'comfortable',                     // or 'compact'
  onCopy(value, columnKey, row) {
    // No clipboard bypass: request the declared capability from the tool action.
    return trickIt.request('clipboard-write', String(value ?? ''));
  }
});
grid.update({ rows: updatedRows, columns: updatedColumns });
grid.setPage(1);
grid.remove();
```

The copy action is an icon button with a localized tooltip and accessible label, not a text button squeezed into each cell. Set `copyable: false` on a column to hide it, `sortable: false` to disable sorting, `searchable: false` to omit a column from search, and `visible: false` to hide a column initially. A `format(value, row)` function changes display text only; `onCopy` still receives the original raw value. Values are inserted with `textContent`, never HTML. Searching/sorting/pagination only affect the viewport, not the source array or exports. Locale/theme changes preserve search, sorting, density and the current page.

### Deferred/external asset loader

Use `ui.loader(target, options)` for resource loading rather than building another spinner. It reuses the clay status card, shows real byte counts/percentages when known, and has localized waiting/loading/verifying/initializing/done/error labels. Unknown progress stays indeterminate—never estimate a percentage from elapsed time.

```js
const loader = trickIt.ui.loader('#model-loading'); // element or selector
try {
  // Same permissions and integrity checks as trickIt.asset; no direct network access.
  const resource = await loader.asset('model');
  // Download completion is not engine readiness: initialization is tool-owned.
  loader.update({ phase: 'initializing' });
  const model = await initializeEngine(resource.bytes);
  loader.done('Model ready'); // localize custom copy in the tool
} catch (error) {
  loader.fail(); // friendly localized error; retain input and allow an explicit retry
}
```

A completed loader hides itself after about 2.5 seconds (pass `autoHide: false` to keep it) and can be closed manually, so tools that load several assets do not leave a stack of "Asset ready" cards. Create one loader per concurrent asset in the same container; do not create a new one each time a stage changes.

`loader.asset(id)` resolves to the unchanged `{ bytes: ArrayBuffer, type }` resource **after** SHA-256 verification, or shows an error and rethrows the original failure (including its `code`). A failed attempt can be retried with the same loader; it never retries or downloads automatically. Use one loader per concurrent asset; duplicate requests for the same asset still share one host download. `done` means the resource bytes are ready, not that an engine has initialized. `remove()` detaches the card/locale listener but does not abort a shared download; host revocation still aborts pending work.

For tool-owned loading (e.g. engine initialization or a worker reporting progress), use `loader.update({ phase, loaded, total, title, detail })`. Phases: `waiting`, `loading`, `verifying`, `initializing`, `done`, `error`. `loaded`/`total` are byte counts for loading/verifying; omit them when unknown. Controllers also expose `.done(title?, detail?)`, `.fail(title?, detail?)`, `.element`, and `.remove()`. Default labels follow locale changes without restarting the work. All custom text is rendered as text, not HTML.

Existing callers can subscribe without rendering a card: `trickIt.asset('model', { onProgress({ loaded, total, phase }) {} })`; progress is host-authenticated, bounded and scoped to the pending request, including cache reads and integrity verification. A callback exception rejects that caller's promise; it does not authorize or cancel another request. Existing `trickIt.asset(id)` calls remain compatible. Automatic (`defer: false`) downloads happen before the frame launches and continue to use the host's loading card.

Popups and toasts are text only (title ≤120, message ≤800, ≤12 items, labels ≤40, toast ≤240 characters) and one popup is shown at a time. If the host is busy (another popup or a permission prompt is open), `ui.info`/`ui.confirm` wait briefly and retry; they never fall back to an in-frame modal, and resolve `false` if the host stays busy. An in-frame fallback is used only when no host/SDK channel exists. **Do not open an in-frame `<dialog>`**: the iframe grows with its content, so a modal inside it is centred in the frame, not on screen. Without a host (a standalone file), the kit falls back to in-frame rendering.

## Request a sensitive operation

Declare the matching permission and its reason in the manifest first. Call the SDK only in response to a meaningful tool action. The host checks the calling frame, random session channel, request ID, declared capability and remembered decision. The first request for a permission shows a host popup ("Allow" / "Don't allow"); the answer is stored per tool, so later requests run without asking (a remembered refusal rejects with `denied`). Camera and location still show their live preview/precision step, and protected services confirm the exact input and security check every time. Arbitrary sibling frames cannot submit a valid request for this tool. Native browser permissions are separate and can still deny the operation.

Permission dialogs restore the previous parent-owned focus target, usually the iframe. After an authenticated response, the SDK can restore its connected local control when the frame is focused and focus is on the document body; it never overrides a newer local control or host-page focus. Asset responses/progress and toasts do not redirect focus. Keep the initiating action focusable with `aria-disabled` and a re-entry guard while awaiting a dialog, or explicitly focus the appropriate surviving control afterwards: native `disabled` can erase the target. The parent never reads the opaque child document.

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

A public wiki tool may declare `wiki-read` and call `trickIt.request('wiki-read', { site: 'https://en.wikipedia.org', title: 'Ada Lovelace', endpoint: '/w/api.php' })`. The host confirms each new site in the session, then fetches only the public Action API article with credentials omitted, CORS enforced, no redirects and a 2 MiB response limit. It returns `{ title, html, revision }`. The frame never gets network access. Only HTTPS public hosts and restricted `api.php` paths are allowed; independent MediaWiki sites must permit CORS. Always parse returned markup inertly (DOMParser) and render preview with `textContent`. This privilege is for **retrieving public wiki content**, not crawling arbitrary sites.

**Wiki pictures.** The same `wiki-read` grant also serves article pictures: `trickIt.request('wiki-read', { site: 'https://en.wikipedia.org', image: 'https://upload.wikimedia.org/…/220px-Ada.jpg' })` resolves to `{ type, bytes }` (an `ArrayBuffer`). It only works for a site already approved in this session, only for HTTPS images on that exact host (or `upload.wikimedia.org` for Wikimedia projects), only raster `image/png|jpeg|gif|webp`, credentials omitted, no redirects, 8 MiB limit. Requests are sequential: retry on `busy`. Decode and re-encode in the tool (canvas) and build documents locally; nothing goes to a server.

**DNS lookups (`dns-query`).** A tool can ask for public DNS records without contacting the target host: `trickIt.request('dns-query', { name: 'example.com', type: 'CNAME' })`. The host queries three fixed DNS-over-HTTPS resolvers (Cloudflare `cloudflare`, Google `google`, and Cloudflare's malware-filtering `cloudflare-security`; CORS JSON API, credentials omitted, no redirects, 64 KiB cap, 8 s timeout) from the user's browser and returns `{ name, type, results: [{ provider, status, ad, answers: [{ name, type, ttl, data }], authority }] }`. Allowed types: `A AAAA CNAME NS MX TXT CAA SOA DS DNSKEY`. Names must be public ASCII hostnames (Punycode for IDNs; no IPs, no `localhost`/`.internal`/`.local`/`.arpa`). The permission is asked once and remembered; the hostname is disclosed to the resolvers, so the tool UI must say so. A provider failing is tolerated; both failing rejects.

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

Do not request these sequentially at startup; the snippet only documents their payloads. Clipboard text is capped at 1 MiB. Downloads are capped at 16 MiB, use a simple filename of at most 120 characters without path separators, and accept the supported MIME types `text/plain`, `text/csv`, `text/html`, `application/json`, `application/octet-stream`, `application/pdf`, `image/png` and `image/svg+xml`. Downloads never accept arbitrary remote URLs. Location results contain only the host's bounded position data `{ latitude, longitude, accuracy }`; do not assume a native `GeolocationPosition` object crosses the bridge. The host routes the whole location flow: it triggers the browser prompt, explains how to unblock a site-level denial, previews the fix and lets the user share it precisely or approximately (rounded to about 1 km, `accuracy` at least 1100 m). A blocked or cancelled request rejects with `denied`; a slow fix rejects with `timeout`; an unavailable position rejects with `unsupported`.

User cancellation, denial, an unsupported API, an insecure context, a concurrent request, revocation or navigation can reject a promise. Catch failures, announce a friendly explanation and preserve user work. The host does not display raw exception details or pretend that platform approval overrides browser/OS policy. Camera still capture is available as `trickIt.request('camera-capture')` with no payload, returning `{ bytes: ArrayBuffer, mime: 'image/png' }`. The host controls the preview and stops camera tracks on cancel or revoke. PNG and SVG are accepted by downloads; `share-image` accepts `{ filename, mime: 'image/png', bytes: ArrayBuffer }` for native sharing where supported. Microphone and direct network access remain unsupported; `wiki-read` is a dedicated, limited wiki reader rather than general network access.

## Load a pinned model only when needed

Declare `external-assets` and any relevant `wasm`/`workers` policy capability, provide the resource's exact byte count/SHA-256, and have the registry owner approve its HTTPS origin. Use `defer: true` for a model the user may never need.

```js
async function initializeModel() {
  if (!window.trickIt) throw new Error('Hosted model loading is unavailable.');
  const loading = window.trickIt.ui.loader('#model-loading');
  try {
    const resource = await loading.asset('model');
    if (resource.type !== 'wasm') throw new Error('Unexpected resource type');
    loading.update({ phase: 'initializing' });
    const { instance } = await WebAssembly.instantiate(resource.bytes, {});
    loading.done('Model ready.');
    return instance;
  } catch {
    loading.fail();
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

Decisions are stored per tool ID in the user's own browser (`localStorage`, never sent anywhere). A release that declares a new permission is asked about that permission only. **Reset access and restart** clears the tool's decisions, destroys its iframe and aborts pending work/requests. Store important output only through deliberate user actions. Never send user data to the parent for logging or analytics.

The host checks the release JSON identity and bootstrap HTML digest before embedding. A release/version mismatch, unsupported runtime, invalid digest, oversized resource or missing grant fails closed with a retry/recovery path. The platform's PWA update flow must ask before reloading an active workspace. A user's approval to download a model is not permission to silently replace it with bytes from a mutable URL.

For every release, test accepted and declined permissions, browser-native denial, revocation during a request, cache corruption, offline startup, optional model failure, mobile focus behavior, and preservation of input/output during language/theme changes. No live private GitHub or model endpoint is considered verified solely because a mocked test passes.
