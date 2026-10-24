# Shared runtime harness for tool-owned tests

Tool behavior/UI tests live in each independent tool repository, not here. This directory contains only the generic host support used by those suites.

The harness mounts the real `ToolRuntime` and `HostUi`, injects the real sandbox/SDK, uses the host stylesheet/navigation CSP, and serves the owning repository's freshly built HTML and manifest. It does not read catalog registrations or published pins, copy the shared UI implementation into a tool release, execute tool code in Node, or proxy live protected services.

In the tool repository, pin a compatible Playwright runner and create `playwright.host.config.mjs`:

```js
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (!process.env.TRICK_IT_DIR) throw new Error('Set TRICK_IT_DIR to a compatible trick-it checkout.');
const { toolHostConfig, serveToolHost } = await import(pathToFileURL(resolve(process.env.TRICK_IT_DIR, 'tests/tool-harness/index.mjs')).href);
const options = { toolRoot: fileURLToPath(new URL('.', import.meta.url)) };
if (process.argv[2] === '--serve') await serveToolHost(options);
export default toolHostConfig(options);
```

Put scenarios in that tool's `tests/host/*.spec.ts` and add:

```json
"test:host": "npm run build && playwright test --config playwright.host.config.mjs"
```

Install dependencies in both checkouts, install the matching Playwright Chromium, then run from the tool repository:

```sh
TRICK_IT_DIR=/path/to/trick-it npm run test:host
```

The harness serves all twelve supported locale routes (English at the unprefixed route). Its test-only **Test host locale** select updates the real runtime's locale prop without remounting the iframe. Use it to assert live translations, fallback, focus and preserved input/output; use the site's actual language selector separately for navigation coverage. The selector is harness-only and is never shipped in production.

Startup applies the **complete registry manifest schema**, including translated name/description bounds and all required fields in any supplied SEO object. A checksum-valid bundle with invalid metadata must fail before browser launch, just as registry synchronization would. This is schema validation, not approval of the source owner's trust or translation quality.

For `localePacks` repository `file` descriptors, the harness verifies the owning tool's local JSON bytes at startup and serves them at the same `/bundles/<tool-id>/locales/<sha256>.json` paths as Pages. Browser tests should use those real endpoints, not CDN mocks. Corrupt/missing/escaped source files fail before startup; individual browser tests may intercept a response to exercise runtime integrity failure and retry. External URL packs still need explicit fixtures when their remote hosting is unavailable.

Derive tool browser loops from the compatible host contract instead of copying the locale list:

```js
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { languageCodes } = await import(pathToFileURL(resolve(process.env.TRICK_IT_DIR, 'src/lib/languages.js')).href);
```

For every locale, assert a known tool-native label/error against the owning catalog, not only `html.lang` or shared picker text. Retain the same iframe/contentWindow, active editor node/selection, file input and File objects, generated data and pending operation. Cover 320–375px and desktop, initial non-English startup, rapid switches, corrupt/missing packs and retry. Local catalogs and flat UTF-8 locale JSON must also pass `scripts/check-tool-release.mjs`; that structural check cannot certify UI coverage or language quality. Do not add tool-specific cases to this host directory.

Check the owner's CI fixture setup before running: model/resource caches and their environment variables are explicit prerequisites. Tools with optional startup capabilities need a deliberate **Start with selected permissions** action; leave unrelated optional permissions off. For downloads, test native-picker and buffered Blob stream sinks independently. A native file save is not a Playwright `download` event, and every `download-begin` needs fresh activation even after a remembered grant. A mocked native picker covers stream mechanics only, not real OS activation.

The default port is 4190; suites run sequentially. A browser executable override must match the runner version. Mock protected endpoints and browser camera/clipboard implementations in the owning tests when required. Normal publication still requires registry validation and the release checklist; this harness does not certify manifest trust, UI compliance or live provider access.

The host retains generic runtime/SDK/security/permission, catalog, navigation, SEO and PWA tests. Tool transformations, format-specific controls, imports/exports, image/decoder behavior and result assertions belong to the tool.
