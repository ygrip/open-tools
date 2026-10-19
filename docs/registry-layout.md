# Per-tool registry (marketplace model)

trick-it is a **build-time marketplace**, not a runtime code downloader. Every independently owned tool repository publishes its own `tool.manifest.json` and reviewed `dist/index.html`. The host fetches only those two files from a pinned Git commit; it validates the manifest, byte limits, SHA-256, trusted owner and external-asset origins before publishing the isolated browser bundle.

```
config/
  registry.json             # shared trust, discovery and optional auth policy
  tools/
    json-tools.json         # immutable standalone release
    text-manipulation.json  # immutable remote source
    id-generator.json       # another immutable remote source (when registered)
```

To register a new production tool, **add only** `config/tools/<id>.json`:

```json
{
  "repository": "ygrip/id-generator",
  "ref": "633e6b044a21493dec72f5741f447b0e0ba60d6d",
  "added": "2026-10-18T03:17:15Z"
}
```

The filename must equal the manifest ID. `ref` must be the complete 40-character lowercase commit SHA. `added` is the optional UTC registration time (`YYYY-MM-DDTHH:MM:SSZ`) used by the homepage "Newest first" sort and JSON-LD `datePublished`; keep it unchanged when updating `ref`.

Each tool owns its catalog art in **its own repository** and declares it in `tool.manifest.json` (schema v3). trick-it holds no copy: `npm run registry:sync` fetches the files at the pinned commit, verifies exact size, SHA-256 and image container, and materialises them at build time.

```json
"artwork": {
  "icon": { "file": "assets/icon.webp", "sha256": "<64 hex>", "bytes": 4321 },
  "card": { "file": "assets/card.png", "sha256": "<64 hex>", "bytes": 98765 }
}
```

- `icon` (required when `artwork` is present): 160×160 WebP, ≤12,000 bytes, shown on catalog cards and the tool page. Published as `/icons/tools/<id>.<first-12-hex-of-sha256>.webp`.
- `card` (optional): 512×512 transparent PNG, ≤400,000 bytes, used only as the source for the tool's social preview. It is never served.
- Both paths are relative to the repository root, and a changed file is picked up only by re-pinning. Pick a tile colour and symbol no other tool uses. A tool without `artwork` falls back to its manifest line icon.

**Cache busting.** The icon URL contains a content hash, so any art change yields a new URL and `static/_headers` marks `/icons/tools/*`, `/bundles/*` and `/_app/immutable/*` as `immutable` for a year. Bundles are already addressed by their HTML SHA-256, and social images by a digest in the file name. Never add a mutable file under those paths. The generated `static/icons/tools/` and `scripts/.generated-tool-cards/` are ignored build output.

The sync combines validated manifests into `src/lib/registry/generated.json` for the app, route generation and metadata. This file is ignored build output, just like `static/bundles/`; do not edit or commit it. A combined output is useful at runtime, while independent `config/tools/<id>.json` files keep source changes separate and avoid generated-file merge conflicts. CI regenerates the complete catalog from the merged registrations. Worker service policies and generated Wrangler configuration follow the same rule.

## Existing local development fixture

`config/tools/json-tools.json` now pins the standalone JSON Tools v0.3.0 release. The local mirror was deleted after verifying the exact HTML and manifest against the new source commit. All production entries use immutable remote commits; local development fixtures, if intentionally used, still undergo digest checks.

## Credentials and builds

Remote private GitHub repositories require `TOOLS_GITHUB_TOKEN` or a repository-scoped GitHub App/PAT with **Contents: read**. The host's default `GITHUB_TOKEN` does not normally read sibling private repositories. Provide secrets to both registry sync and build; never put them in registration files or browser bundles. Public tool JavaScript is deployed as part of the static site even when the source repository is private.

Run `npm run registry:sync`, then `npm test`, `npm run check`, `npm run build` and browser tests. Sync fails closed if a registration is missing, malformed, points to a mutable ref, has a mismatched ID/digest, duplicates an existing ID/repository, or cannot be fetched. Existing output is retained on validation failure.

## Compatibility and security

The global `config/registry.json` selects the `toolDirectory` and owns `trustedOwners`, discovery policy, `auth` and `trustedAssetOrigins`. If an alternate configuration omits `toolDirectory`, the legacy `sources` array is still supported so existing auth examples and independent builds keep working. Mixing `sources` and `toolDirectory` is rejected.

Do not enable automatic discovery merely to remove registration work: only an approved pinned commit authorizes a production tool. Updating the tool repository alone does not update the published version. The loader does not run third-party install/build scripts.
