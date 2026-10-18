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

The default port is 4190; suites run sequentially. A browser executable override must match the runner version. Mock protected endpoints and browser camera/clipboard implementations in the owning tests when required. Normal publication still requires registry validation and the release checklist; this harness does not certify manifest trust, UI compliance or live provider access.

The host retains generic runtime/SDK/security/permission, catalog, navigation, SEO and PWA tests. Tool transformations, format-specific controls, imports/exports, image/decoder behavior and result assertions belong to the tool.
