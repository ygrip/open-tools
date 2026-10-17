---
name: open-tools-scaffold
description: Scaffold a new independent browser tool, migrate it to the Open Tools v2 host-theme contract, publish its self-contained HTML release, or register/update its pinned source in the Open Tools catalog. Use for requests such as create a tool, scaffold another tool, add a tool repository, register a private tool, or release a new tool version.
---

# Open Tools tool scaffolding

Read the project recipe at [docs/scaffold-tool.md](../../../docs/scaffold-tool.md) **from the repository root**. Relative to this skill directory, that file is `../../../docs/scaffold-tool.md`. It contains copyable dependency-free HTML, Node builder, manifest and artifact-test examples; no scaffolding CLI is assumed.

## Establish the boundary

1. Identify the tool's operation, ID, category, capabilities, approved GitHub owner/repository and intended source location. Ask only for consequential missing inputs. Search existing registry IDs and source folders before choosing a path; preserve all existing registrations and never overwrite an existing tool scaffold.
2. Inspect the current `src/lib/registry/contract.js`, `src/lib/registry/sandbox.ts`, `config/registry.json`, `scripts/lib/bundles.mjs` and relevant authentication docs. The implementation is authoritative if the recipe has drifted.
3. Keep the tool independently buildable in its own repository. Use `examples/<id>` only for the explicit local development mirror. Do not import the tool's source/framework into the host or add a runtime API dependency.

## Build the tool

- Start with the minimal recipe in the guide or the existing JSON Tools builder for larger dependency-bundled tools. Adapt behavior, labels and limitations to the requested operation; do not ship an unchanged counter under another name.
- Release one self-contained UTF-8 HTML document, including inline scripts/styles/assets, plus `tool.manifest.json`. No external runtime requests, secrets, telemetry, CDN dependencies, unsafe evaluation, parent-DOM access, storage or clipboard permissions. Do not weaken CSP or add `allow-same-origin`.
- Support the site's clay styling and both themes. Consume the root `--ot-*` tokens; add `[data-theme="dark"]` rules for any custom colors. The host injects the root theme and its validated, one-way theme receiver. Do not duplicate that receiver, introduce a competing theme toggle/preference, or reload and lose user input on theme changes. Never send user data to the parent.
- Require `schemaVersion: 2` and `appearance: { theme: "host", protocolVersion: 1 }`. The metadata path is exactly `/<id>` without a trailing slash, even though the public route is `/<id>/`.
- Respect reserved IDs and all current contract limits. Keep human-facing metadata truthful. `repository` must match the registered `https://github.com/owner/repository`; `bundle.file` is a safe relative `.html` path. Update SHA-256 from the **exact final HTML bytes** after each build, not before minification or newline changes. Never leave the placeholder digest in a release.
- Keep the bundle below the 5 MiB hard limit and the stricter current 90,000 gzip-byte tool budget. Add input limits, errors that preserve user input, keyboard access, visible focus, 44px targets and reduced-motion support where applicable. Synchronous CPU-heavy code can freeze an iframe/tab; the sandbox is not a CPU isolation guarantee.

## Verify and publish

1. Run the tool's functional tests and build. Test empty/invalid/large/Unicode inputs as appropriate; artifact checksum smoke tests alone are insufficient. Review the actual HTML for external loads and credential/private-sample leakage.
2. Register the built local mirror under `examples/` and run `npm run registry:sync`. Test the actual host iframe in both themes, including a live theme change that preserves input/output, mobile layout and keyboard/error states. Add targeted browser regression coverage.
3. Run host `npm test`, `npm run check`, `npm run build`, `npm run performance:check` and `npm run test:e2e`. Install Playwright Chromium only if needed. Report exactly which checks ran and their results; do not imply static review is runtime verification.
4. Before any commit, configure **both author and committer** as `ygrip <yunaz.gilang@gmail.com>`; explicitly verify the resulting commit identity. Do not inherit a corporate global identity. Commit source, manifest, release HTML and dependency lockfile (if any) in the same standalone source commit. Never commit `node_modules`, credentials or real private samples. Do not push or rewrite history without authorization.
5. After the source commit exists on GitHub, register its full lowercase 40-character SHA and approved owner in Open Tools. Local paths cannot point outside `examples/`; remote refs cannot be branch names/tags/short SHAs. Keep discovery disabled unless explicitly authorized. Re-run checks using the intended production configuration, then commit/push the registry change when authorized. Deploy the complete static output atomically.

## Private-source credentials

Read [docs/registry-auth.md](../../../docs/registry-auth.md) from the repository root. Credentials belong only to Node registry-sync/build environment variables. Resolution is repository override → owner mapping → `TOOLS_GITHUB_TOKEN` → `GITHUB_TOKEN` → anonymous; explicitly configured missing secrets must fail closed. Configure read-only PATs or GitHub App installations without placing literal secrets or private keys in manifests, tool bundles, browser environment variables or committed configuration. A private source repository does not make its published JavaScript or repository provenance private.

## Completion report

Give the tool route, files changed, exact tests/build results, released source SHA and registration state. Distinguish a local scaffold from a published release and a verified credential mock from live private-GitHub access. State any remaining approval, secret configuration, browser review or deployment requirement with one concrete next action.
