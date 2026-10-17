# Open Tools

A static SvelteKit aggregator for independent browser tools. Each registered tool is a **versioned bundle plus a manifest contract**, not an imported source repository. Tool repositories may be private; their released browser bundles and catalog metadata are public.

## Run

Requires Node.js 22+.

```sh
npm ci
npm run registry:sync
npm run dev
```

Open `/json-tools` for JSON formatting, JSONPath queries, JSON → XML and XML → JSON. The checked-in first bundle works offline without GitHub credentials. Its independently buildable source is mirrored in `examples/json-tools`; the standalone scaffold is published at `git@github.com-personal:ygrip/json-tools.git`, commit `231d88c31914448e10a0f6d6f9704ea73805453b`.

```sh
npm test
npm run check
npm run build
# Optional browser verification (after installing Chromium):
npx playwright install chromium
npm run test:e2e
```

`npm run build` syncs approved bundles before building the static site. The build output is `build/`; deploy it to any static host. It includes prerendered tool routes and JSON-encoded bundle files. Deploy the complete output atomically, not just the catalog. `npm run dev` requires an initial sync; rerun sync and restart development after registry changes.

## Bundle contract v1

Every repository publishes `tool.manifest.json` and the referenced self-contained HTML in the **same Git commit**:

```json
{
  "schemaVersion": 1,
  "id": "json-tools",
  "name": "JSON Tools",
  "description": "Format JSON, query with JSONPath, and convert JSON and XML.",
  "path": "/json-tools",
  "category": "data",
  "repository": "https://github.com/ygrip/json-tools",
  "version": "0.1.0",
  "status": "experimental",
  "capabilities": ["json", "jsonpath", "xml"],
  "bundle": {
    "format": "html",
    "file": "dist/index.html",
    "sha256": "<64 lowercase hex characters: SHA-256 of the exact HTML bytes>"
  }
}
```

See `examples/json-tools/tool.manifest.json` for a real manifest with a verified checksum. `src/lib/registry/contract.js` is the shared validation implementation used by the build and catalog.

1. Bundle all JavaScript, CSS and dependencies into one UTF-8 HTML file (maximum 5 MiB). No CDN imports, framework coupling, host callbacks, storage, clipboard permissions or runtime credentials.
2. Generate its SHA-256 and commit the HTML and manifest together. Source maps, server code, secrets and source checkout are not copied by Open Tools.
3. Register its repository and **full 40-character commit SHA** in `config/registry.json`. The owner must appear in `trustedOwners`; IDs/paths must be unique and cannot shadow host routes.

Allowed categories: `media`, `developer`, `data`, `productivity`, `other`. Status: `stable`, `beta`, `experimental`. IDs use lowercase letters/numbers separated by hyphens; paths must equal `/<id>`. Increment the tool version when releasing a new bundle, then explicitly update the pinned registration. No private package registry is required.

## Register a private repository

The local example keeps development credential-free. To load the actual standalone repository, use `config/registry.remote.example.json`, already pinned to the published scaffold, or replace the local source with an immutable remote source:

```json
{
  "trustedOwners": ["ygrip"],
  "topic": "open-tools",
  "discovery": false,
  "sources": [
    {
      "repository": "ygrip/json-tools",
      "ref": "<full 40-character commit SHA>"
    }
  ]
}
```

Set `TOOLS_GITHUB_TOKEN` in your build environment to a fine-grained PAT or GitHub App installation token with **Contents: read** access to each selected private repository. A host repository's default `GITHUB_TOKEN` usually cannot read other private repositories. The token is used only by the Node sync script through the authenticated GitHub API; it is not placed in generated metadata, bundle files, Svelte environment variables or browser code.

```sh
# Inject TOOLS_GITHUB_TOKEN through your secret manager or CI environment.
TOOLS_REGISTRY_CONFIG=config/registry.remote.example.json npm run registry:sync
TOOLS_REGISTRY_CONFIG=config/registry.remote.example.json npm run build
```

The sync reads only the manifest and HTML at the pinned commit, verifies identity, contract, checksum, UTF-8 and size, then publishes sanitized metadata and content-addressed `static/bundles/<id>/<sha256>.json`. It never installs dependencies or executes build scripts from a discovered repository. Authentication failures, invalid contracts and collisions fail the entire sync before replacing current output; they are not silently skipped.

`local: "examples/json-tools"` is an explicit offline scaffold source, constrained to `examples/` with symlink escape checks. Do not use it for private production source. Remote `ref` values cannot be branch names or tags.

## Discovery and approval

Explicit registrations are the default and recommended production approval mechanism. With `discovery: true`, the sync additionally searches trusted owners for the `open-tools` topic, resolves each default branch to a commit and applies the same contract/integrity checks. Private repositories are discoverable only when the build token can see them. Explicit sources take precedence. Discovery follows new releases on each sync, so enable it only if those repositories' maintainers are authorized to publish browser code to your site. A topic is not an independent security review.

`.github/workflows/registry.yml` verifies, builds and uploads the complete static site. Add `TOOLS_GITHUB_TOKEN` as an Actions secret for private sources; external-fork PRs cannot access it and therefore cannot validate private registrations. The workflow does not push generated commits or deploy automatically.

## Isolation and trust

Bundles are served as JSON, **never as executable same-origin HTML**. The loader embeds them using `srcdoc` in an opaque-origin `sandbox="allow-scripts"` iframe. Never add `allow-same-origin`. A host-prepended CSP restricts resource loads, connections, nested frames, workers, form submissions and base URLs. The parent document also restricts frame navigation to its own origin; Chromium regression tests verify external self-navigation is blocked. The bundle cannot access the parent's DOM, cookies or local storage, submit forms, open popups or navigate the top window.

This is defense in depth for **approved code**, not a complete hostile-code containment system. In particular, same-origin frame navigation remains possible and synchronous JavaScript can consume CPU. Review tools before registration; do not paste secrets into untrusted tools. Private source control does not make distributed JavaScript confidential: visitors can inspect the published HTML. The host exposes repository identity as provenance even when the repository is inaccessible to visitors.

## First bundle development

```sh
cd examples/json-tools
npm ci
npm test
npm run build
cd ../..
npm run registry:sync
```

The initial scaffold has been pushed to the standalone repository. For subsequent releases, publish the changed source, lockfile, manifest and HTML together there (excluding `node_modules`), then update the aggregator's pinned ref. See its README for supported JSONPath selectors, XML mapping conventions and limitations.

## Shell features

The existing responsive catalog, category filters, `/` and Cmd/Ctrl+K search, theme toggle, hero dot field, legal pages and error states remain. Reusable shell components live in `src/lib/components`; shared visual tokens live in `src/routes/app.css`. Hero artwork is configured through `DotField` image paths under `static/icons`.
