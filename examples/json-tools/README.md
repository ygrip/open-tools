# JSON Tools

A standalone browser utility distributed to Open Tools as one self-contained HTML bundle. Its repository can remain private; only catalog metadata and the built HTML are published by the aggregator.

## Develop and test

Requires Node.js 20 or later.

```sh
npm install
npm test
npm run build
```

Open `dist/index.html` directly in a browser, or load it through the Open Tools host. There are no runtime CDN dependencies, requests, storage requirements or host framework dependencies. Build dependencies are local to this package.

The build bundles `src/main.js`, `jsonpath-plus` and `fast-xml-parser` into `src/index.html`, writes `dist/index.html`, and updates `bundle.sha256` in `tool.manifest.json`. The source manifest's initial zero digest is not a valid release: run the build before registration. Commit the generated manifest and `dist/index.html` together in the standalone tool repository, then register their immutable Git commit with Open Tools. Never include secrets in browser source or bundles.

## Operations

- **Pretty-print JSON:** validates JSON and formats it with two-space indentation.
- **JSONPath:** property, index, slice, wildcard and recursive selectors; results always form an array. Script expressions and filters requiring evaluation are disabled (`eval: false`).
- **JSON to XML:** wraps input in `<root>`, escapes text, supports `@_attribute` keys and `#text`. Keys must be simple XML names. Unsafe object keys are rejected.
- **XML to JSON:** validates XML, preserves attribute and text values as strings, represents repeated elements as arrays. Attributes use `@_`; mixed text uses `#text`. DOCTYPE and ENTITY declarations are rejected; standard XML entities are decoded.

Numbers use JavaScript floating-point precision. Unsafe integers and non-finite results are rejected rather than silently rounded; encode exact decimals and large integers as strings.

JSON and XML do not have identical data models. Conversion is structural rather than lossless: XML cannot distinguish all null, empty, scalar and array values, and this tool does not infer JSON scalar types from XML text. Namespaces/colon-containing JSON keys are not supported for XML construction. Limit: 1,000,000 input characters and 2,048 JSONPath characters. Very deeply nested or expensive expressions can still exhaust the browser's synchronous parser; this small first bundle does not run processing in a worker.

Use **Load example** for operation-specific input, **Run** to process it, and **Select output** followed by the browser copy shortcut. Selection works without clipboard permission in the aggregator's opaque-origin iframe.

## Light and dark themes

The clay-style workspace uses semantic CSS color tokens: `--ot-bg`, `--ot-surface`, `--ot-text`, `--ot-muted`, `--ot-border`, `--ot-accent`, `--ot-on-accent`, `--ot-shadow`, and `--ot-highlight`. Shadow and highlight tokens are colors, not complete CSS shadow declarations. The host sets `html[data-theme="light"]` or `html[data-theme="dark"]` before displaying the bundle and updates the theme without reloading it, so changing the host theme does not clear your input or output.

When opened standalone without a host-selected theme, the document follows `prefers-color-scheme`. Internal mint/lavender accents, editor surfaces, error colors, and native controls also adapt to the selected mode. All motion is short, interaction-driven, and disabled for `prefers-reduced-motion: reduce`. The workspace keeps its dependencies inline and adds no fonts, runtime network requests, timers, or animation library.

## Distribution contract

`tool.manifest.json` declares schema version 2, host theme protocol v1, identity, catalog metadata, version, and `bundle: { format: "html", file: "dist/index.html", sha256: "…" }`. The SHA-256 covers the exact UTF-8 output bytes. Rebuild after any source, dependency or HTML change, and release the HTML and manifest in the same Git commit.

The host must verify the checksum before publication and load the approved HTML in an iframe with `sandbox="allow-scripts"` (never add `allow-same-origin`). The host owns its frame CSP; this package needs inline scripts/styles but no network, forms, popups, downloads or parent-window access.

Suggested standalone remote: `git@github.com-personal:ygrip/json-tools.git`. Copy this directory into that repository without `node_modules`; install dependencies, run tests/build, and publish the resulting source, lockfile, manifest and `dist/index.html`. Keep the repository private if desired. A private repository does not make its distributed browser bundle secret.
