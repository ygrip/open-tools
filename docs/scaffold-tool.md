# Scaffold and register a trick-it tool

Start with a standalone tool repository. The example shown here can be built as a local fixture in trick-it but must be published to the tool repository before production registration. This recipe creates an independent, dependency-free **Text Counter** example. Change the ID, repository, labels and operation for your tool. It is a copyable recipe, not an installed scaffolding CLI.

Use Node.js 22+. Each release contains one self-contained UTF-8 HTML document and `tool.manifest.json`. Source can be private; published browser code and repository provenance are public.

Keep every tool-specific functional and UI/browser suite in that tool's repository, including real-host SDK integration cases. Use the [shared runtime harness](../tests/tool-harness/README.md) against local built bytes with a compatible `TRICK_IT_DIR` checkout. Do not add a per-tool suite to trick-it or test local changes through an old catalog pin. The host owns generic runtime/security/permission, registry/catalog and site checks.

## Required: shared UI, including existing tools

New scaffolds and releases of existing tools **must use the host-provided `trickIt.ui` components for every applicable interaction**. Follow the [shared-UI release checklist](tool-ui-checklist.md) before implementation and before any push/re-pin. Use `ui.fileInput` for selection/drop/previews, `ui.status` for async job states, `ui.loader` for resource downloads/setup, `ui.toast` for transient notices, and host-centred `ui.info`/`ui.confirm` for popups. Use `ui.codeBlock` for read-only highlighted code output instead of bundling a competing highlighter. The [runtime guide](tool-runtime.md#shared-clay-ui-trickitui) defines the APIs.

If an existing tool uses a competing hosted implementation, modify that tool's source, tests and release artifact; merely restyling it or adding an unused SDK call is not compliance. Minimal native/inline fallbacks are permitted only when the relevant shared API is absent. Never bypass remembered denial with direct browser/network access. Domain-specific editors, charts, persistent validation and result output remain tool-owned; do not add irrelevant UI just to call every API.

The counter below demonstrates a real shared toast on Clear; it has no files, popup or asynchronous work, so those components are not applicable. For a tool with optional model resources, use `const loading = trickIt.ui.loader(target); const resource = await loading.asset('model');` and show engine initialization separately before declaring readiness. Update the API docs and scaffold skill whenever extending the kit.

## Required: Paraglide and separate language files

New production tools and localization migrations **must use Paraglide JS at build time**, with one maintained `messages/<locale>.json` catalog per language and `project.inlang/settings.json`. Pin the compiler and message-format plugin. Validate raw catalogs for matching nonblank keys before Paraglide fallback, compile them, then evaluate generated messages with explicit `{ locale }` options to produce release copy.

Embed generated English fallback only in the HTML. Emit `dist/locales/<locale>.json` for every other supported language and declare `{ file: "dist/locales/<locale>.json", sha256, bytes }` under [`localePacks`](tool-contract-v3.md#language-packs). Each pack is at most 65,536 bytes. `registry:sync` uses the build-only PAT to fetch the pinned repository's files, verifies size/hash/UTF-8/message JSON, and stages the exact bytes at `/bundles/<tool-id>/locales/<sha256>.json` in the Pages output. The host derives same-origin URLs under the site base. Private repositories stay private, the PAT never enters browser output, and repository files need no external-origin approval. Existing public `{ url, sha256, bytes }` packs remain compatible but require approved HTTPS origins. Keep packs separate from generic `assets` and metadata `translations`; load only the selected pack through [`trickIt.localePack(locale)`](tool-runtime.md#language-packs), with no external-assets grant or direct iframe requests. Do not embed all Paraglide runtime locales, duplicate catalogs, phrase-replacement scripts or editable-source archives in the HTML. If offered, ship the source archive as a separate verified deferred asset.

Listen to `trick-it:localechange`, cache successful parsed packs, deduplicate in-flight loads, allow retry after failures, and guard against stale responses. Preserve #101's no-refresh behavior (`63a0222e4b9ff88fae590e78d472824b04d9cb48`): host client-side navigation updates the **existing iframe**, never its `srcdoc` or document identity. Update text/status/accessibility copy without clearing input/output/focus or stopping running jobs. Never use default `setLocale()` or experimental full-document locale builds in the iframe. Older hosts without `localePack` retain readable English without bypassing the sandbox.

### Mandatory tool-owned guide localization

The expanded **Guide / How to use** block on a tool's page is rendered by the host from the tool's `tool.manifest.json`, not from the host's Paraglide messages. For each non-English locale declared in `manifest.locales`, generate **`translations[locale].guide` with both `summary` and `steps`** from that tool's existing Paraglide `messages/<locale>.json` sources during the build, alongside its translated name and description. Each guide string must appear exactly in its corresponding authored locale catalog, including English, so the release checker can detect a separately maintained guide dictionary. Keep English in the canonical `guide` field. Do not maintain a second handwritten guide dictionary.

Every localized guide must preserve the English quick-start's number and order of meaningful steps, safety/permission/privacy caveats, and practical details. Never shorten a four-step guide to a generic one-step summary or silently reuse English prose. Preserve technical identifiers, commands and examples when they cannot be translated. Keep these manifest quick-starts concise to respect the fixed catalog budget; full localized tutorials belong in the selected UI pack/help view.

**The release gate rejects missing guide entries, shortened/extra instruction counts, copied English summaries and copied natural-language English steps.** A missing `translations[locale].guide` normally triggers a host English fallback, which is not localization. Add tool-owned tests that compare manifest guides to the intended Paraglide-authored sources, verify per-locale step parity, and exercise the host guide and iframe language switch without losing workspace state. Structural checks cannot prove linguistic fluency, so review complex explanations with a native speaker.

The dependency-free English counter below illustrates layout, shared UI and artifact mechanics only. **It is not an exception to this production gate**: integrate Paraglide-generated copy and the pack loader before publishing it, including its count/status/toast text. Declare only languages actually translated; do not advertise all twelve for an English fixture.

Require tool-owned browser evidence for each initial language, same-iframe live switches, racing/repeated loads, corrupt/offline packs and retry, preserved active work, both themes and 320–375px layouts. Compare two consecutive builds byte-for-byte across HTML, every pack, any source archive and the manifest; CI must reject any stale artifact. Do not dump generated base64 files into CI logs. Exercise file packs through the host harness's real local endpoints; do not mock GitHub or a CDN in the browser for them. Commit packs with the matching HTML/manifest and pin that source commit, then deploy the complete Pages output together. Only legacy external URL packs need separately published public immutable hosting.

## Production localization and release checks

Run the structural gate from the **owning tool repository**, using an installed compatible host checkout:

```sh
export TRICK_IT_DIR=/path/to/trick-it
npm ci
npm test
npm run test:host
node "$TRICK_IT_DIR/scripts/check-tool-release.mjs" --tool-root "$PWD" --baseline origin/main
```

Fetch `origin/main` before comparing an existing release. Omit `--baseline` only for the first release; automated baseline ordering supports stable `x.y.z` versions, while prerelease ordering needs explicit review. Pin a host commit containing this checker in CI.

The checker derives the required locale set from `src/lib/languages.js` (`languageCodes`), not a copied list. It preflights a locale-scaled gzip catalog-entry budget shared with the production performance check: 8,192 bytes for up to English and Indonesian, plus 1,024 bytes for each additional distinct host-supported locale (18,432 bytes for all twelve). Unsupported or duplicate locale values never increase the allowance. This bounded user-approved headroom permits native per-locale guides and consent reasons; it does not change the 200,000-byte tool bundle, 5 MiB hard acceptance, artwork, shared-JS or language-pack limits. Keep complete native application help in the selected tool locale pack/UI rather than duplicating it into catalog metadata or shared client JavaScript. Final registry performance checks remain authoritative for the actual registration timestamp and complete site. The host keeps the complete catalog behind a server-only boundary and prerenders route data with English fallback plus only the active locale's metadata; do not import all tool translations into client JavaScript. Locale navigation must load its static `__data.json` without replacing a running iframe. It rejects missing/blank authored keys and changed placeholders **before compiler fallback can hide them**, missing native metadata/consent reasons/**guide translations**, translated guide step-count drift and copied English instructional prose, floating compiler/plugin versions, missing or inconsistent lockfiles, unchanged release versions, and missing, nested, corrupt or incorrectly projected locale packs. Repository-file packs must be flat objects of nonblank string messages. If the application uses nested error/issue groups, reconstruct those groups **after** validating the flat delivered pack; do not publish nested JSON that passes a tool-only test but fails the real host.

This is a structural gate, **not** a native-language or UI certification. It cannot prove that every message is actually used, detect all English literals, or certify a translator. Inventory visible and accessibility copy in initial, help, invalid-input, busy, cancellation, retry and completed states. Generate `translations[locale].name/description` and permission reasons from authored native copy, with regression tests; a manifest listing locales is insufficient. Keep unreviewed localized SEO `noindex`. Existing runtime compatibility with legacy inline dictionaries does not make that layout a valid new scaffold: new production releases use English-only bootstrap plus separate packs.

Real-host browser tests must use the owning built bundle through `tests/tool-harness`, **not an older production catalog pin**. The harness validates the entire registry manifest before starting: localized descriptions must fit 240 characters, and any supplied SEO object needs its title, description, keywords and robots fields even when `robots` is `noindex`. Derive their locale loop from the same host `languageCodes`; assert native labels/errors, the same iframe/contentWindow, editor node and selection, imported file/input identities, generated data and pending work at 320–375px and desktop. Switch through multiple new locales and back to English. Also test missing/corrupt packs, retry, racing responses and initial non-English startup. A mocked SDK or compiler-only/VM test is not a replacement for this browser evidence. Keep tool-specific suites in the tool repository.

Read the owner's CI fixture setup before local runs: verified model/resource caches and environment variables are not implicitly supplied. Suites sharing harness port 4190 run sequentially. For `downloadStream`, test both the native file-picker sink and the buffered Blob sink; neither is the legacy `request('downloads')` API. A native save is not a browser `download` event, and each `download-begin` requires fresh user activation even after approval. Preserve remembered-denial coverage separately. A mocked picker proves stream handling, not real OS picker/user-activation behavior.

Release evidence must name the **exact tested SHA**, Node/npm versions and results. An ancestor's green CI does not validate a newer `[skip ci]` artifact commit. Distinguish passing, missing, pending, genuinely failed and billing-blocked checks; override only explicitly authorized billing-only failures with proof that jobs never started and exact-head local checks passed. Never call unavailable CI green or weaken tests/permissions to merge.

Use `npm ci` with the committed lockfile. Diagnose the first npm error, working directory and Node/npm/configuration before changing dependencies. When creating a genuinely missing lock, resolve it in a clean disposable checkout without `node_modules`, then prove ordinary `npm ci` and builds/tests succeed. Preserve existing dependency graphs for version-only edits; do not regenerate unrelated locks, use `--force`, or bypass peer resolution to obtain a pass. Ignore `node_modules/`, `test-results/`, `playwright-report/` and temporary host checkouts; commit catalogs/config, lockfile, HTML, packs, manifest and any separate source archive together.

Build twice and compare every release byte. Rebuild the intended merge result; matching Git trees alone is not a rebuild check. Rebuild and verify the actual merged SHA before publishing its version tag/release or pinning it. Never move an existing release tag. Preserve each registration's `added` timestamp and pin the full merged commit SHA on the requested host branch, not a feature head, tag name or unrelated `main`. A published tool release, host-PR pin, deployed host and fluent-copy approval are distinct states.

## 1. Create the local scaffold

```sh
mkdir -p examples/text-counter/src examples/text-counter/scripts examples/text-counter/test
```

Create `examples/text-counter/package.json`:

```json
{
  "name": "text-counter",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "node scripts/build.mjs",
    "test": "npm run build && node --test"
  }
}
```

Create `examples/text-counter/.gitignore`:

```gitignore
node_modules/
src/paraglide/
test-results/
playwright-report/
.host/
.env
.env.*
.DS_Store
```

Do **not** ignore `dist/`: the release HTML and manifest must be committed together. No npm install is needed for this dependency-free example.

Create `examples/text-counter/tool.manifest.json`:

```json
{
  "schemaVersion": 3,
  "runtimeVersion": 1,
  "appearance": { "theme": "host", "protocolVersion": 1 },
  "icon": "braces",
  "seo": { "title": "Text Counter", "description": "Count Unicode code points locally in your browser.", "keywords": ["text", "unicode", "counter"], "robots": "index" },
  "guide": { "summary": "Count text without sending it to a server.", "steps": ["Paste text into the input.", "Read the code-point count.", "Use Clear text to start again."] },
  "permissions": [],
  "assets": [],
  "translations": {},
  "id": "text-counter",
  "name": "Text Counter",
  "description": "Count Unicode code points locally in your browser.",
  "path": "/text-counter",
  "category": "productivity",
  "repository": "https://github.com/ygrip/text-counter",
  "version": "0.1.0",
  "status": "experimental",
  "capabilities": ["text", "unicode", "counting"],
  "bundle": {
    "format": "html",
    "file": "dist/index.html",
    "sha256": "0000000000000000000000000000000000000000000000000000000000000000"
  }
}
```

The zero digest is a placeholder. Build before registering; it is not a valid release checksum. Replace `ygrip/text-counter` if another approved owner publishes the source.

Create `examples/text-counter/src/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Text Counter</title>
  <style>
    :root {
      font-family: ui-rounded, system-ui, sans-serif;
      color-scheme: light;
      --ot-bg: #fff8f0; --ot-surface: #fffdf9; --ot-text: #392f2c;
      --ot-muted: #71615a; --ot-border: #e7d8cc; --ot-accent: #f7a174;
      --ot-on-accent: #42291e; --ot-shadow: rgba(62,36,20,.12);
      --ot-highlight: rgba(255,255,255,.92);
    }
    :root[data-theme="dark"] {
      color-scheme: dark;
      --ot-bg: #242127; --ot-surface: #312c34; --ot-text: #fff5eb;
      --ot-muted: #cbbab3; --ot-border: #514650; --ot-accent: #ffb18b;
      --ot-on-accent: #3e251d; --ot-shadow: rgba(0,0,0,.35);
      --ot-highlight: rgba(255,255,255,.075);
    }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; background: var(--ot-bg); color: var(--ot-text); }
    main { max-width: 760px; margin: auto; }
    h1 { margin-top: 0; }
    p { color: var(--ot-muted); line-height: 1.6; }
    label { display: block; font-weight: 750; margin-bottom: 12px; }
    textarea {
      width: 100%; min-height: 220px; resize: vertical; padding: 16px;
      font: inherit; color: var(--ot-text); background: var(--ot-surface);
      border: 1px solid var(--ot-border); border-radius: 20px;
      box-shadow: inset 0 2px 4px var(--ot-shadow);
    }
    button {
      min-height: 44px; padding: 12px 20px; font: inherit; font-weight: 750;
      color: var(--ot-on-accent); background: var(--ot-accent);
      border: 1px solid var(--ot-border); border-radius: 16px; cursor: pointer;
      box-shadow: inset 0 2px 1px var(--ot-highlight), 0 4px 0 var(--ot-shadow);
    }
    :focus-visible { outline: 3px solid var(--ot-text); outline-offset: 4px; }
    output { display: block; padding-block: 20px; font-weight: 750; }
  </style>
</head>
<body>
  <main>
    <h1>Make every character count.</h1>
    <p>Your text stays in this browser. This counts Unicode code points, not visual graphemes.</p>
    <label for="text">Your text</label>
    <textarea id="text" maxlength="20000" placeholder="Drop in a little text…"></textarea>
    <output for="text" id="count" aria-live="polite">0 Unicode code points</output>
    <button id="clear" type="button">Clear text</button>
  </main>
  <script>
    const input = document.getElementById('text');
    const count = document.getElementById('count');
    function update() {
      count.textContent = `${Array.from(input.value).length} Unicode code points`;
    }
    input.addEventListener('input', update);
    document.getElementById('clear').addEventListener('click', () => {
      input.value = '';
      update();
      input.focus();
      // Hosted: use the provided UI. Standalone: clearing still works without it.
      if (window.trickIt?.ui) void window.trickIt.ui.toast('Text cleared', { tone: 'success' });
    });
  </script>
</body>
</html>
```

The host supplies `html[data-theme]`, the `--ot-*` tokens, and its validated theme-message receiver **before tool scripts run**. Do not set a competing root theme, use stored preferences, reload on theme changes, or duplicate the receiver. The CSS above uses host tokens for all surfaces; its root defaults also permit opening the file standalone. `--ot-shadow` and `--ot-highlight` are colors, not complete shadow declarations.

For frameworks or larger tools, bundle dependencies and inline their output, as in [the standalone JSON Tools builder](https://github.com/ygrip/json-tools/blob/main/scripts/build.mjs). Do not issue external loads from the iframe: bundle resources, embed data URLs, or use declared assets through the verified host loader. `eval`, `new Function`, arbitrary fetch, forms, parent-DOM access, cookies and ambient browser privileges are not supported. WASM, blob workers and script-asset blob imports require their corresponding host grants; sensitive browser actions use the consent broker described below. Never weaken the opaque `sandbox="allow-scripts"` iframe by adding `allow-same-origin`.

## 2. Build the immutable artifact and add a smoke test

Create `examples/text-counter/scripts/build.mjs`:

```js
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const bytes = await readFile(new URL('src/index.html', root));
if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('HTML must be 1 byte to 5 MiB');
const html = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
if (!/<!doctype html/i.test(html)) throw new Error('Expected an HTML document');
const manifestUrl = new URL('tool.manifest.json', root);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
if (manifest.bundle?.format !== 'html' || manifest.bundle.file !== 'dist/index.html') {
  throw new Error('This builder outputs dist/index.html only');
}
manifest.version = JSON.parse(await readFile(new URL('package.json', root), 'utf8')).version;
manifest.bundle.sha256 = createHash('sha256').update(bytes).digest('hex');
await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/index.html', root), bytes);
await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built ${bytes.length} bytes; SHA-256 ${manifest.bundle.sha256}`);
```

Create `examples/text-counter/test/bundle.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

test('release contains the expected HTML and matching theme-aware v3 manifest', async () => {
  const root = new URL('../', import.meta.url);
  const bytes = await readFile(new URL('dist/index.html', root));
  const manifest = JSON.parse(await readFile(new URL('tool.manifest.json', root), 'utf8'));
  assert.equal(manifest.schemaVersion, 3);
  assert.equal(manifest.runtimeVersion, 1);
  const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  assert.equal(manifest.version, pkg.version);
  assert.deepEqual(manifest.appearance, { theme: 'host', protocolVersion: 1 });
  assert.equal(manifest.path, `/${manifest.id}`);
  assert.equal(manifest.bundle.sha256, createHash('sha256').update(bytes).digest('hex'));
  const html = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  assert.match(html, /<!doctype html/i);
  assert.match(html, /id="text"/);
  assert.match(html, /data-theme="dark"/);
  assert.match(html, /window\.trickIt\.ui\.toast\(/);
});
```

Run from Open Tools:

```sh
npm test --prefix examples/text-counter
```

This is an artifact smoke test, not functional/security coverage. Add operation tests for empty, invalid, large and Unicode inputs before release. Complex operations should report friendly errors without discarding input or rendering raw exception details. Set input limits or chunk expensive work so a synchronous tool cannot freeze the tab.

## 3. Register and test locally

For a temporary local development fixture, add `config/tools/text-counter.json`; production uses an immutable remote source:

```json
{ "repository": "ygrip/text-counter", "local": "examples/text-counter" }
```

Local sources must resolve under `examples/`; arbitrary sibling paths and symlink escapes are rejected. Local mirrors are for scaffold development, not private production source.

```sh
npm run registry:sync
npm run dev
```

Open `/text-counter/`. Enter `hello`: expect `5 Unicode code points`. Clear: expect zero and focus back in the input. Enter text, change the **host** theme and confirm colors change without losing input. Inspect the tool at 320px/375px and desktop widths, both themes, keyboard-only and reduced-motion settings. Add browser coverage for your operation and live theme preservation, using `tests/browser/bundles.spec.ts` and `tests/browser/visuals.spec.ts` as patterns. Confirm there are no unexpected console errors or network requests.

Run the host checks after adding the browser test:

```sh
npm test
npm run check
npm run build
npm run performance:check
npm run test:e2e
```

Playwright requires Chromium (`npx playwright install chromium` on a fresh setup). Registry sync validates the complete contract, repository identity, uniqueness, checksum, UTF-8 and size; it does not execute the tool's build. Current performance policy caps each compressed tool at 200,000 gzip bytes, below the unchanged 5 MiB hard acceptance limit. This user-approved per-tool ceiling does not justify embedding all language catalogs or source archives; use the separate-pack gate above. Catalog metadata receives 8,192 gzip bytes for up to two locales, plus 1,024 bytes per additional distinct host-supported locale (18,432 bytes for all twelve); unsupported or duplicate locales add no allowance. This only budgets localized metadata/guides and consent reasons. Shared JavaScript, 200,000-byte tool bundles, 5 MiB hard acceptance, separate language packs and artwork budgets remain independently enforced.

For deferred models, scripts, workers and browser capabilities, read [the v3 contract](tool-contract-v3.md) and [runtime/consent guide](tool-runtime.md). Assets need approved `trustedAssetOrigins`, exact byte sizes and SHA-256. The host downloads and verifies them only after consent; the iframe still cannot fetch arbitrary URLs. Use `trickIt.ui.loader(target).asset(id)` for visible verified-resource loading (or `trickIt.asset(id, { onProgress })` when integrating a shared loader already in use), and `request(permission, payload)` for brokered capabilities. Do not bundle credentials or add `allow-same-origin`. New tools should declare translated metadata and respond to `trick-it:localechange` without clearing input. See [SEO configuration](seo.md) for automatic social cards and production canonical URLs.

Contract reminders:

- IDs: lowercase letters/digits separated by hyphens, at most 64 characters; `path` must be exactly `/<id>` (no trailing slash). The host's public route uses a trailing slash.
- Reserved IDs include `policy`, `privacy`, `terms`, `bundles`, `icons`, `brand`, `illustrations`, `index`, `404`, `500`, `503`, `_app`, the `id` locale prefix, and platform `offline`, `manifest`, `service-worker`, `pwa`, `og`, `robots`, `sitemap` namespaces. Recheck [`contract.js`](../src/lib/registry/contract.js) for changes.
- Categories: `media`, `developer`, `data`, `productivity`, `other`. Status: `stable`, `beta`, `experimental`. `version` is `major.minor.patch` with an optional prerelease suffix.
- Names: nonempty, at most 80 characters; descriptions: nonempty, at most 240. Capabilities: at most 20 nonempty strings, each at most 80 characters.
- Repository: exact `https://github.com/owner/repository` provenance matching the configured source. Bundle: safe relative `.html` path, lowercase 64-character SHA-256. Schema v1 is rejected; declaring v2 does not replace visual/security review.

## 4. Publish the standalone repository

**Do not push yet:** complete the [shared-UI release gate](tool-ui-checklist.md), fix existing nonconforming UI in the tool repository, and ensure the scaffold skill and runtime docs match the provided APIs. Source checks alone do not replace behavioral tests.

Create an **empty** private GitHub repository for the tool first; do not initialize it with competing files. Choose a fresh sibling directory; never overwrite an existing checkout. From Open Tools:

```sh
set -eu
mkdir ../text-counter
cp -R examples/text-counter/. ../text-counter/
cd ../text-counter
git init -b main
git config user.name ygrip
git config user.email yunaz.gilang@gmail.com
# Complete the production Paraglide/pack/browser gate above first.
: "${TRICK_IT_DIR:?Set an installed compatible host checkout}"
npm ci
npm test
npm run test:host
node "$TRICK_IT_DIR/scripts/check-tool-release.mjs" --tool-root "$PWD"
git add package.json package-lock.json messages project.inlang src scripts test tests dist tool.manifest.json .gitignore
GIT_AUTHOR_NAME=ygrip GIT_AUTHOR_EMAIL=yunaz.gilang@gmail.com \
GIT_COMMITTER_NAME=ygrip GIT_COMMITTER_EMAIL=yunaz.gilang@gmail.com \
  git commit -m "feat: release independent text counter"
git remote add origin git@github.com-personal:ygrip/text-counter.git
git push -u origin main
git log -1 --format='%H %an <%ae> | %cn <%ce>'
```

Use the configured personal SSH alias shown above only if it exists in your environment; otherwise configure the correct personal account before pushing. Both author **and committer** must be `ygrip <yunaz.gilang@gmail.com>`, not inherited corporate defaults. Verify the printed identity and copy the full 40-character commit SHA. Add a tool-specific README explaining behavior, limitations, build/test commands and privacy before a real release.

The standalone source commit must contain the matching `dist/index.html`, generated `dist/locales/*.json`, separate source archive (if provided), source catalogs/config, dependency lockfile and manifest. Open Tools downloads these artifacts only; it never installs dependencies or builds an untrusted tool repository. Never commit credentials or real private input samples.

## 5. Pin and release through trick-it

Back in trick-it, replace the content of `config/tools/text-counter.json` with the released source ref, retaining all other per-tool files:

```json
{ "repository": "ygrip/text-counter", "ref": "<full lowercase 40-character commit SHA>" }
```

Add its owner to global `trustedOwners` only after approval. Branches, tags and shortened SHAs are rejected. Keep `discovery: false` for explicit production approval. An alternate complete registry configuration can be selected with `TOOLS_REGISTRY_CONFIG`; apply that same environment setting to sync **and build**.

For private sources, supply read-only credentials to the **Open Tools build**, not the tool runtime. See [multi-owner authentication](registry-auth.md): repository mapping → owner mapping → `TOOLS_GITHUB_TOKEN` → `GITHUB_TOKEN` → anonymous. Put only environment-variable names in configuration; an explicitly configured missing secret fails closed. GitHub App installation descriptors support separate owners and short-lived tokens. Neither sync nor the builder automatically loads `.env` files.

Run sync, host tests, check, build, performance checks and browser tests again using the production registry configuration. Commit the registry change as `ygrip <yunaz.gilang@gmail.com>` and deploy the **entire** static build atomically. For every subsequent tool release, bump its version, rebuild, test, commit and push the artifact/manifest together, then review and update the pinned SHA here. A push to the tool repository alone does not update the pinned `config/tools/<id>.json` registration.

## Optional protected online features

Local tools should keep `permissions: []` and omit services. A tool that needs a reviewed host service can opt into the [protected service schema](protected-services.md). Declare the `services` permission plus feature ID, allowlisted handler, rate limit, and explicit Turnstile setting. Request it through the SDK; never fetch arbitrary URLs, embed an API key, or implement a CAPTCHA inside the sandbox. These protections apply to the host Worker endpoint, not to local JavaScript computation.
