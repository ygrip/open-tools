# Shared localization starter for standalone tools

This is a **partial** first-pass UI phrase seed, not complete tool translation. Tool-specific headings, instructions, errors, aria copy, and guide text must be translated inside each tool's own repository. English fallback stays in place for missing messages. Vendored files need tool-specific coverage and tests before an immutable release is pinned.

To adopt in a tool repository, vendor `multilingual-ui.js` and `shared-phrases.json` under `src/`, `localize-build.mjs` under `scripts/`, and invoke the build script after writing the normal `dist/index.html` and `tool.manifest.json`. The injector adds common controls and adjusts the manifest digest. Each tool must own its translations. Do not report a tool as fully localized simply because it includes this starter.
