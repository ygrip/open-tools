# Tool metadata contract v3

Use v3 for new `trick-it` tools that need richer presentation, a user guide, capabilities or separately downloaded resources. A manifest describes a reviewed release, not a blanket permission grant. The host still embeds independently released HTML in an opaque `sandbox="allow-scripts"` iframe.

## Compatibility

Version 2 remains accepted for existing pinned releases. It receives a default toolbox icon, SEO derived from its name/description, a generic guide and empty permissions/assets/translations. V2 cannot acquire capabilities by adding nonempty `permissions` or `assets`; migrate to v3 first. Version 1 remains rejected. Normalized public catalog entries contain these defaults, not unknown/private manifest fields.

V3 requires `runtimeVersion: 1` in addition to `appearance: { "theme": "host", "protocolVersion": 1 }`. An unsupported runtime or theme protocol fails registration before publication. The runtime version is a protocol integer, distinct from the independently versioned tool release.

## Minimal v3 manifest

See [`examples/tool.manifest.json`](../examples/tool.manifest.json) for a copyable local-only template and [the standalone JSON Tools manifest](https://github.com/ygrip/json-tools/blob/main/tool.manifest.json) for the first tool. Fill in a real checksum after building; the all-zero digest in the template is only a placeholder.

```json
{
  "schemaVersion": 3,
  "runtimeVersion": 1,
  "appearance": { "theme": "host", "protocolVersion": 1 },
  "id": "text-counter",
  "name": "Text Counter",
  "description": "Count Unicode code points locally in your browser.",
  "path": "/text-counter",
  "category": "productivity",
  "repository": "https://github.com/ygrip/text-counter",
  "version": "0.1.0",
  "status": "experimental",
  "capabilities": ["text", "counting"],
  "icon": "braces",
  "seo": {
    "title": "Text Counter",
    "description": "Count text without sending it to a server.",
    "keywords": ["text", "Unicode"],
    "robots": "index"
  },
  "guide": {
    "summary": "Your text stays in the isolated local tool.",
    "steps": ["Enter text.", "Review the count.", "Clear the input when finished."]
  },
  "permissions": [],
  "assets": [],
  "translations": {},
  "bundle": {
    "format": "html",
    "file": "dist/index.html",
    "sha256": "0000000000000000000000000000000000000000000000000000000000000000"
  }
}
```

## Presentation and guides

`icon` is a built-in icon name, not an external image or arbitrary SVG/HTML. Supported names are `braces`, `toolbox`, `grid`, `sparkles`, `bolt`, `heart`, `filter`, `lock`, `shield` and `search`.

`seo` requires a nonempty title (100 characters maximum), description (320 maximum), up to ten nonempty keyword strings (80 each), and `robots: "index" | "noindex"`. The host renders these as text metadata; tool metadata does not authorize scripts, HTML or arbitrary canonical origins.

`guide` requires a nonempty summary (500 maximum) and one to twelve nonempty steps (500 each). Explain the operation, input limits, output, privacy, any permission prompts and optional-resource behavior. Do not describe a network-dependent tool as local-only.

Optional `translations.en` / `translations.id` each require localized `name` and `description`; they may also provide a complete localized `guide` and/or `seo` object with the same limits. Canonical fields are the fallback. Other locale keys are rejected until the host supports them. Metadata localization does not automatically translate the HTML bundle. Declare the actual interface languages in optional `locales` (a nonempty unique list of `en`/`id`, default `["en"]`), and use the runtime locale bridge described in [the runtime guide](tool-runtime.md). The host keeps an unsupported tool interface in its first supported language rather than mislabeling English controls as Indonesian.

## Layout contract

The manifest does not prescribe a frame height. The platform owns the available width, starting-height fallback, and sandbox isolation; each tool owns its responsive HTML/CSS and natural page height. A host-installed observer sizes the iframe to the rendered tool content so the outer page scrolls normally. No new schema field or runtime permission is required, and existing v2 tools receive the same behavior.

Avoid wrapping entire tools in viewport-height scroll panes. Tool-specific bounded editors, menus, and tables may still scroll where appropriate. See [tool-owned workspace layout](tool-runtime.md#tool-owned-workspace-layout) for implementation guidance.

## Shared UI release requirement

New and updated tools must consume the provided `trickIt.ui` components wherever their features apply: file inputs/drop/previews, job status, asset loaders, toasts and host-centred information/confirmation popups. Follow the [shared-UI release gate](tool-ui-checklist.md); migrate nonconforming existing controls in the tool repository before publishing. This is a behavioral release requirement, not a new manifest field. Registry schema/checksum validation alone does not certify it. See the [runtime API](tool-runtime.md#shared-clay-ui-trickitui).

## Capability declarations

A descriptor has exactly the public shape below. Unknown fields are not published.

```json
{
  "name": "clipboard-read",
  "reason": "Read text only after you explicitly choose Paste from clipboard.",
  "required": false
}
```

Supported permission names:

- `clipboard-read` and `clipboard-write`: host-mediated text access with a remembered first-use permission decision.
- `geolocation`: host-routed position access. The host shows the browser/OS prompt when needed, guidance when the site is blocked, a preview, and a precise/approximate choice before anything reaches the tool.
- `services`: invoke only features declared in the optional `services` array through the host broker. Each declares an allowlisted handler, a per-feature native rate limit and a Turnstile requirement. The Worker enforces the generated policy; see [protected services](protected-services.md).
- `downloads`: a confirmed host download of bounded bytes, including PNG and SVG; never a remote URL.
- `camera-capture`: a one-shot host camera preview that captures a bounded PNG only after user approval; the opaque iframe never gets the camera stream.
- `share-image`: native share sheet for a generated PNG only, with a remembered first-use permission decision and browser fallback.
- `external-assets`: allow declared, pinned public resources to be downloaded and cached locally.
- `wasm` and `workers`: permit isolated WebAssembly compilation and/or tool-created blob workers through conditional CSP. These are platform policy capabilities, not browser permission names.

Names must be unique. A reason is required and limited to 240 characters; `required` must be a boolean. Microphone, arbitrary network access and same-origin iframe privileges are **not implemented**; declaring an unsupported permission fails closed rather than pretending to grant it.

Startup permissions (`wasm`, `workers`, `external-assets`) are chosen in one host popup before launch; required ones must be selected to start. Runtime permissions are asked on first use. Each decision is remembered per tool in the user's browser and never asked again until the user resets access; a remembered refusal makes the request reject with `denied`, so the tool must handle it without losing user input. A declaration never triggers a browser prompt automatically. Reset destroys the runtime rather than leaving privileged code running. Camera and location keep their per-use preview, and protected services confirm each request. Browser denial, missing support, insecure contexts and user cancellation remain possible after platform consent.

## Deferred assets and machine-learning resources

Assets are separate from the self-contained bootstrap HTML. Each entry must identify exact bytes:

```json
{
  "id": "model",
  "url": "https://models.example/model-v1.wasm",
  "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
  "bytes": 1048576,
  "type": "wasm",
  "defer": true
}
```

This is illustrative: replace the URL, byte count and placeholder digest with a real reviewed resource before use. Types are `wasm`, `script`, `worker` and `data`. IDs follow the lowercase hyphenated tool-ID syntax and must be unique. URLs must be HTTPS without username/password, fragments, whitespace or backslashes. Never place credentials, signed private URLs or user data in public metadata or URL query strings.

The accepted ceiling is 16 assets, 64 MiB per asset and 128 MiB in total. These are hard safety limits, not recommended download targets. Publish larger ML models as reviewed bounded shards or change the host policy explicitly; do not lie about byte counts. The server must allow public browser CORS requests with credentials omitted. Redirects are rejected. A public source URL can still become unavailable; handle that state and show retry instructions.

Every asset requires the `external-assets` declaration. WASM assets additionally require `wasm`; worker assets require `workers`. For automatic resources (`defer: false`), the host downloads only resources whose related capabilities were granted before creating the iframe. A deferred resource is downloaded only after the tool requests its declared ID. An optional declined resource must not be downloaded speculatively.

The registry owner must independently approve every origin in the selected build configuration:

```json
{
  "trustedOwners": ["ygrip"],
  "trustedAssetOrigins": ["https://models.example"],
  "sources": [
    { "repository": "ygrip/text-counter", "ref": "<full lowercase 40-character commit SHA>" }
  ]
}
```

Approval is exact scheme/host/port origin equality, not a suffix, wildcard or URL prefix. Configured origins must be canonical origin strings without a trailing slash/path/query. Sync validates approvals before fetching the bootstrap bundle, but does **not** download or execute external models during the build. Approval permits a download attempt; runtime byte-count and SHA-256 checks still apply to network and cached bytes before transfer into the iframe. Scripts and WASM are never executed in the parent platform.

## Releases, validation and caches

Existing ID/path/category/status/repository rules still apply. Names are limited to 80 characters, descriptions to 240, and capabilities to twenty strings of at most 80 characters. Reserved routes include the legal pages, bundle/static namespaces, `offline`, `manifest`, `manifest-webmanifest`, `service-worker` and `pwa`; inspect [`contract.js`](../src/lib/registry/contract.js) before choosing an ID.

The bootstrap remains a self-contained UTF-8 HTML file of at most 5 MiB and is subject to the stricter configured gzip budget. Build it, update its SHA-256 from the exact final bytes, and commit the artifact and manifest together. Preserve the tool repository provenance even when the platform display brand changes. Keep credentials build-only.

The host publishes `/bundles/<id>/<html-sha256>.json` containing `{ id, version, sha256, html }`. The browser checks the envelope's release identity and recomputes the HTML SHA-256 before embedding. A version query distinguishes metadata-only releases with unchanged HTML bytes; resource cache keys use the pinned resource digest. Permission decisions are remembered per tool across releases; a newly declared permission still needs its own decision. Reset access clears those decisions and aborts the old runtime.

Tool version strings are limited to 80 characters. For a new release, bump the version, rebuild/test, publish the source commit, and update the full pinned source SHA in the registry. Branch names, tags and short SHAs remain invalid. Deploy the complete static output atomically. Do not silently reload an active tool when a platform update becomes available: let the user preserve work and accept the update.

Run host contract/runtime tests, type-check, build, performance budgets and browser tests after registration. Review actual prompts, denial/revocation, progress/retry, offline/cache corruption, language/theme preservation and narrow mobile layouts. Static schema validation cannot prove a tool's honesty, privacy claims, accessibility or CPU cost.

## Optional Worker-backed features

Existing local-only tools omit `services` or set it to `[]`. New online features require schemaVersion 3 and a declared `services` permission. No arbitrary server URL, secret, executable handler or client override is permitted.

```json
"services": [{
  "id": "audit",
  "handler": "pagespeed-seo",
  "rateLimit": { "limit": 5, "periodSeconds": 60 },
  "turnstile": true
}]
```

At most eight services are accepted. IDs are unique lowercase hyphenated names, maximum 32 characters. `pagespeed-seo` is the initial host-owned handler. Rate limits require integer `limit` 1–60 and `periodSeconds` 10 or 60. `turnstile` must be an explicit boolean. Unknown nested keys are rejected. A new handler requires reviewed host code; registering a tool cannot introduce an arbitrary proxy. Limits are approximate per-IP/per-Cloudflare-location. Local computations cannot be securely limited by this server policy.
