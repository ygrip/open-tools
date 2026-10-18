# Required shared UI for tool releases

This is a **release gate** for new scaffolds, feature changes and migrations of existing tools. Read the [runtime API](tool-runtime.md#shared-clay-ui-trickitui) for exact options. The platform supplies `window.trickIt.ui`; tools must consume it, not copy its implementation into their bundles.

## Required component by feature

| Tool feature | Required hosted component | Do not ship a competing implementation |
| --- | --- | --- |
| File selection, drag/drop, selected-file previews | `ui.fileInput(target, options)` | Custom hosted drop zones, native-only hosted pickers, duplicate validation/preview widgets |
| Waiting, async processing, completion, failure | `ui.status(target, options)` | Hand-rolled job spinners or transient status banners |
| Deferred/external asset download or engine setup | `ui.loader(target, options)`; use `.asset(id)` for declared downloads | Custom download spinners, fake percentages, direct network fetches |
| Copied, saved, downloaded or other transient notices | `ui.toast(message, { tone })` | Tool-owned toast stacks or browser alerts |
| Help/instructions/information popup | `ui.info(options)` | Hosted in-frame modal dialogs |
| Destructive-action confirmation | `ui.confirm(options)` | `window.confirm` or a competing hosted modal |

The rule applies **when the feature exists**. A synchronous text counter does not need a file picker or an artificial loading screen. Domain-specific editors, charts, result tables, persistent input validation and inline contextual explanations remain tool-owned. Interactive forms that cannot be expressed by text-only popups must be inline panels, not custom modal overlays. If the kit cannot represent a necessary interaction, extend the host kit and document/test that API first; do not silently bypass it in a tool.

## Migration procedure

1. Inventory applicable features in the existing source, including wrappers and imported components. Identify current file inputs/drop listeners, loaders/spinners, notices, `alert`/`confirm`, and `<dialog>`/`showModal` calls. Check the rendered behavior too: a source-string match alone cannot prove compliance.
2. Replace each hosted implementation with the matching shared component. Preserve type/size/count limits, callbacks, file previews, cancellation, keyboard access, test selectors where practical, output and user input. Keep domain-specific file-content validation after the shared picker's generic validation.
3. Use one loader per concurrent asset; `await loader.asset(id)` returns verified bytes. Show initialization separately with `loader.update({ phase: 'initializing' })`. Never announce engine readiness at download completion. Keep retries explicit and preserve the workspace after denial, corrupt bytes or network failure.
4. Keep fallback UI only behind **absence of the relevant SDK API**, for standalone files or older hosts. Never choose custom UI while the provided API exists. A denied capability is not permission to use a direct browser/network fallback. Remove unused hosted markup, CSS and handlers after replacement; fallback native inputs must not stay visible alongside the shared picker. Do not duplicate the kit's CSS/JavaScript.
5. Update EN/ID copy and tests without resetting inputs, files, results or running work on locale/theme changes. Default shared labels already follow locale changes. Use first-use remembered permission wording; camera/location retain per-use previews and protected services retain per-request confirmation.

## Test ownership

Tool-specific functional, UI, import/export, decoder and workflow tests belong in the **tool's own repository**, including tests that exercise the real trick-it runtime/SDK. Run them there against a compatible host checkout; do not add a per-tool suite to `trick-it/tests/browser` or depend on the catalog's currently published pin to test local tool changes.

The host owns shared runtime/SDK/UI-kit, sandbox/security, permission, host-service, registry/catalog, navigation, SEO and PWA tests. Use synthetic fixtures for cross-cutting behavior. Catalog smoke checks may open a registered tool, but must not assert that tool's transformations, formats, forms or result data. Keep tool-specific regression coverage when moving tests; do not replace it with source-token checks.

## Evidence required before commit/push

For **each applicable row**, record its source integration and a passing behavioral check. Mark other rows “not applicable” with the reason. A token `.ui` reference, an unused helper or screenshot of restyled custom controls is not evidence.

- File picker: select **and drop** valid files; check type/size/count refusal, previews/removal, disabled selection/drop/removal during processing, and the unchanged workspace after invalid replacement.
- Job/asset UI: shared card appears while pending; real progress when available, indeterminate otherwise; success only after work completes; error/retry and cancellation preserve prior output. Asset tests must verify hash failure never exposes usable bytes.
- Popups/notices: actual shared toast and parent-viewport dialog appear; no in-frame hosted modal; confirmation supports cancel, Escape and focus return. Forms stay inline.
- Host integration: both themes and EN/ID where declared; 320–375px without document overflow; keyboard and reduced-motion behavior; remembered permission allowance/refusal and reset.
- Release: run build, functional tests and applicable browser checks; bump package/manifest versions consistently, rebuild the exact HTML digest, review the complete diff, commit source/tests/manifest/artifact together, then re-pin only after the source commit is published. Preserve the registration's `added` timestamp.

Do not push or re-pin a nonconforming release. Fix the existing tool in its own repository first. Report blocked checks explicitly; do not mark a migration complete with failing or unexecuted checks.

This gate is enforced by the scaffold/migration workflow, review and behavioral tests. Registry schema/checksum validation does **not** execute arbitrary tool code or certify UI compliance; do not weaken sandbox isolation or introduce a misleading source-regex “certificate” to make that claim.
