# Open Tools

Open-source utility hub that auto-registers and serves standalone tools through safe manifest-based discovery and routing.

## Why

Open Tools is a small shell for independent web utilities. A tool can keep its own repository and release cycle while the hub owns catalog metadata, validation, and routing policy.

The guiding rule is **auto-discovery, not auto-trust**.

## Scaffold

- SvelteKit 5
- static adapter friendly
- manifest-driven catalog
- responsive bento-style UI
- search and category filtering
- dark/amber visual system inspired by the Raksara design language
- no runtime backend required for the shell

## Development

```bash
npm install
npm run dev
```

Validate the app with:

```bash
npm run check
npm run build
```

## Tool manifest

Each registered utility is described by a constrained manifest:

```json
{
  "id": "gerak",
  "name": "Gerak",
  "description": "Convert motion assets between browser-friendly formats.",
  "path": "/gerak",
  "category": "media",
  "repository": "https://github.com/example/gerak",
  "capabilities": ["gif", "lottie", "webp"],
  "status": "experimental"
}
```

Current validation enforces:

- lowercase `[a-z0-9-]` IDs
- path must exactly match `/<id>`
- HTTPS GitHub repository URL
- typed category and status values

The initial registry is intentionally empty. CI-based trusted repository discovery and generated routing should be added as a separate step instead of mixing deployment privileges into the first UI scaffold.

See `examples/tool.manifest.json` for the contract shape.
