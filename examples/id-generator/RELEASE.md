# ID Generator published release

This directory is an **artifact-only mirror** of [ygrip/id-generator](https://github.com/ygrip/id-generator), currently private.

- Reviewed source release: `633e6b044a21493dec72f5741f447b0e0ba60d6d`.
- HTML SHA-256: `769eb9684060b2b4a31608fc9601efac9cde3aaf3d9f19365be72e784ad66408`.
- Copies only the published `dist/index.html` and `tool.manifest.json`. Build-time secrets or private source are never mirrored.
- Uses an explicit local artifact to keep public trick-it CI/build working without cross-repository private GitHub credentials. The host still checks contract, UTF-8, size, and bundle hash at every sync.
- To update: run `npm run verify` in the standalone repository, commit both release files, copy just those two files here, update this note with the new full commit SHA, run `npm run registry:sync` and all host checks.

For an authenticated immutable remote source instead, change this entry in `config/registry.json` to `{ "repository": "ygrip/id-generator", "ref": "<40-character release SHA>" }` and configure `TOOLS_GITHUB_TOKEN` with read-only Contents access to the private source repo.

Specs and security caveats are documented in the standalone README.
