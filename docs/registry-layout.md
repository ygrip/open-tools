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
  "ref": "633e6b044a21493dec72f5741f447b0e0ba60d6d"
}
```

The filename must equal the manifest ID. `ref` must be the complete 40-character lowercase commit SHA. There is no copied HTML, release Markdown or tool manifest in trick-it. The tool repository owns source, documentation and release assets. Each registration can be added or updated in an independent PR without modifying a shared `sources` array.

## Existing local development fixture

`config/tools/json-tools.json` now pins the standalone JSON Tools v0.3.0 release. The local mirror was deleted after verifying the exact HTML and manifest against the new source commit. All production entries use immutable remote commits; local development fixtures, if intentionally used, still undergo digest checks.

## Credentials and builds

Remote private GitHub repositories require `TOOLS_GITHUB_TOKEN` or a repository-scoped GitHub App/PAT with **Contents: read**. The host's default `GITHUB_TOKEN` does not normally read sibling private repositories. Provide secrets to both registry sync and build; never put them in registration files or browser bundles. Public tool JavaScript is deployed as part of the static site even when the source repository is private.

Run `npm run registry:sync`, then `npm test`, `npm run check`, `npm run build` and browser tests. Sync fails closed if a registration is missing, malformed, points to a mutable ref, has a mismatched ID/digest, duplicates an existing ID/repository, or cannot be fetched. Existing output is retained on validation failure.

## Compatibility and security

The global `config/registry.json` selects the `toolDirectory` and owns `trustedOwners`, discovery policy, `auth` and `trustedAssetOrigins`. If an alternate configuration omits `toolDirectory`, the legacy `sources` array is still supported so existing auth examples and independent builds keep working. Mixing `sources` and `toolDirectory` is rejected.

Do not enable automatic discovery merely to remove registration work: only an approved pinned commit authorizes a production tool. Updating the tool repository alone does not update the published version. The loader does not run third-party install/build scripts.
