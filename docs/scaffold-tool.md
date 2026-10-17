# Scaffold and register a trick-it tool

Start in the trick-it platform repository (`ygrip/open-tools`). This recipe creates an independent, dependency-free **Text Counter** example. Change the ID, repository, labels and operation for your tool. It is a copyable recipe, not an installed scaffolding CLI.

Use Node.js 22+. Each release contains one self-contained UTF-8 HTML document and `tool.manifest.json`. Source can be private; published browser code and repository provenance are public.

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
    });
  </script>
</body>
</html>
```

The host supplies `html[data-theme]`, the `--ot-*` tokens, and its validated theme-message receiver **before tool scripts run**. Do not set a competing root theme, use stored preferences, reload on theme changes, or duplicate the receiver. The CSS above uses host tokens for all surfaces; its root defaults also permit opening the file standalone. `--ot-shadow` and `--ot-highlight` are colors, not complete shadow declarations.

For frameworks or larger tools, bundle dependencies and inline their output, as in [`examples/json-tools/scripts/build.mjs`](../examples/json-tools/scripts/build.mjs). Do not issue external loads from the iframe: bundle resources, embed data URLs, or use declared assets through the verified host loader. `eval`, `new Function`, arbitrary fetch, forms, parent-DOM access, cookies and ambient browser privileges are not supported. WASM, blob workers and script-asset blob imports require their corresponding host grants; sensitive browser actions use the consent broker described below. Never weaken the opaque `sandbox="allow-scripts"` iframe by adding `allow-same-origin`.

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
  assert.deepEqual(manifest.appearance, { theme: 'host', protocolVersion: 1 });
  assert.equal(manifest.path, `/${manifest.id}`);
  assert.equal(manifest.bundle.sha256, createHash('sha256').update(bytes).digest('hex'));
  const html = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  assert.match(html, /<!doctype html/i);
  assert.match(html, /id="text"/);
  assert.match(html, /data-theme="dark"/);
});
```

Run from Open Tools:

```sh
npm test --prefix examples/text-counter
```

This is an artifact smoke test, not functional/security coverage. Add operation tests for empty, invalid, large and Unicode inputs before release. Complex operations should report friendly errors without discarding input or rendering raw exception details. Set input limits or chunk expensive work so a synchronous tool cannot freeze the tab.

## 3. Register and test locally

Add the source to `config/registry.json`, **preserving existing sources and approved owners**:

```json
{
  "trustedOwners": ["ygrip"],
  "topic": "open-tools",
  "discovery": false,
  "sources": [
    { "repository": "ygrip/json-tools", "local": "examples/json-tools" },
    { "repository": "ygrip/text-counter", "local": "examples/text-counter" }
  ]
}
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

Playwright requires Chromium (`npx playwright install chromium` on a fresh setup). Registry sync validates the complete contract, repository identity, uniqueness, checksum, UTF-8 and size; it does not execute the tool's build. Current performance policy also caps each compressed tool at 90,000 gzip bytes, below the 5 MiB hard acceptance limit.

For deferred models, scripts, workers and browser capabilities, read [the v3 contract](tool-contract-v3.md) and [runtime/consent guide](tool-runtime.md). Assets need approved `trustedAssetOrigins`, exact byte sizes and SHA-256. The host downloads and verifies them only after consent; the iframe still cannot fetch arbitrary URLs. Use `window.trickIt.asset(id)` for verified bytes and `request(permission, payload)` for brokered capabilities. Do not bundle credentials or add `allow-same-origin`. New tools should declare translated metadata and respond to `trick-it:localechange` without clearing input. See [SEO configuration](seo.md) for automatic social cards and production canonical URLs.

Contract reminders:

- IDs: lowercase letters/digits separated by hyphens, at most 64 characters; `path` must be exactly `/<id>` (no trailing slash). The host's public route uses a trailing slash.
- Reserved IDs include `policy`, `privacy`, `terms`, `bundles`, `icons`, `brand`, `illustrations`, `index`, `404`, `500`, `503`, `_app`, the `id` locale prefix, and platform `offline`, `manifest`, `service-worker`, `pwa`, `og`, `robots`, `sitemap` namespaces. Recheck [`contract.js`](../src/lib/registry/contract.js) for changes.
- Categories: `media`, `developer`, `data`, `productivity`, `other`. Status: `stable`, `beta`, `experimental`. `version` is `major.minor.patch` with an optional prerelease suffix.
- Names: nonempty, at most 80 characters; descriptions: nonempty, at most 240. Capabilities: at most 20 nonempty strings, each at most 80 characters.
- Repository: exact `https://github.com/owner/repository` provenance matching the configured source. Bundle: safe relative `.html` path, lowercase 64-character SHA-256. Schema v1 is rejected; declaring v2 does not replace visual/security review.

## 4. Publish the standalone repository

Create an **empty** private GitHub repository for the tool first; do not initialize it with competing files. Choose a fresh sibling directory; never overwrite an existing checkout. From Open Tools:

```sh
set -eu
mkdir ../text-counter
cp -R examples/text-counter/. ../text-counter/
cd ../text-counter
git init -b main
git config user.name ygrip
git config user.email yunaz.gilang@gmail.com
npm test
git add package.json src scripts test dist tool.manifest.json .gitignore
GIT_AUTHOR_NAME=ygrip GIT_AUTHOR_EMAIL=yunaz.gilang@gmail.com \
GIT_COMMITTER_NAME=ygrip GIT_COMMITTER_EMAIL=yunaz.gilang@gmail.com \
  git commit -m "feat: release independent text counter"
git remote add origin git@github.com-personal:ygrip/text-counter.git
git push -u origin main
git log -1 --format='%H %an <%ae> | %cn <%ce>'
```

Use the configured personal SSH alias shown above only if it exists in your environment; otherwise configure the correct personal account before pushing. Both author **and committer** must be `ygrip <yunaz.gilang@gmail.com>`, not inherited corporate defaults. Verify the printed identity and copy the full 40-character commit SHA. Add a tool-specific README explaining behavior, limitations, build/test commands and privacy before a real release.

The standalone source commit must contain the matching `dist/index.html` and manifest. Open Tools downloads these artifacts only; it never installs dependencies or builds an untrusted tool repository. Never commit credentials or real private input samples.

## 5. Pin and release through trick-it

Back in Open Tools, replace the new local source with its immutable source ref, retaining existing registrations:

```json
{ "repository": "ygrip/text-counter", "ref": "<full lowercase 40-character commit SHA>" }
```

Add its owner to `trustedOwners` only after approval. Branches, tags and shortened SHAs are rejected. Keep `discovery: false` for explicit production approval. An alternate complete registry configuration can be selected with `TOOLS_REGISTRY_CONFIG`; apply that same environment setting to sync **and build**.

For private sources, supply read-only credentials to the **Open Tools build**, not the tool runtime. See [multi-owner authentication](registry-auth.md): repository mapping → owner mapping → `TOOLS_GITHUB_TOKEN` → `GITHUB_TOKEN` → anonymous. Put only environment-variable names in configuration; an explicitly configured missing secret fails closed. GitHub App installation descriptors support separate owners and short-lived tokens. Neither sync nor the builder automatically loads `.env` files.

Run sync, host tests, check, build, performance checks and browser tests again using the production registry configuration. Commit the registry change as `ygrip <yunaz.gilang@gmail.com>` and deploy the **entire** static build atomically. For every subsequent tool release, bump its version, rebuild, test, commit and push the artifact/manifest together, then review and update the pinned SHA here. A push to the tool repository alone does not update an explicit registration.
