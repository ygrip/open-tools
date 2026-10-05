# Open Tools

Open-source utility hub that auto-registers and serves standalone tools through safe manifest-based discovery and routing.

## Why

Open Tools is a small shell for independent web utilities. A tool can keep its own repository and release cycle while the hub owns catalog metadata, validation, and routing policy.

The guiding rule is **auto-discovery, not auto-trust**.

## Scaffold

- SvelteKit 5
- static adapter friendly
- automatically generated tool catalog
- responsive bento-style UI
- hero search with `/` keyboard shortcut and category filtering
- Raksara-style dot-field hero seeded from configurable SVG/logo assets
- Terms, Privacy, and Tool Policy pages
- dedicated 404/error state
- empty registry and empty search states
- dark/amber visual system inspired by the Raksara design language

## Development

```bash
npm install
npm run registry:sync
npm run dev
```

Validate the app with:

```bash
npm run check
npm run build
```

## Automatic registration

A repository is discovered automatically when all of these are true:

1. its owner appears in `config/registry.json -> trustedOwners`
2. the repository has the configured GitHub topic, currently `open-tools`
3. the repository contains `tool.manifest.json` at its root
4. the manifest passes validation
5. its ID and path do not collide with another registered tool

The registry refresh workflow runs daily and can also be triggered manually. Invalid manifests are skipped rather than taking down the catalog.

The discovery boundary is deliberately narrow: adding a topic to an arbitrary repository is not enough unless its owner is trusted.

## Tool manifest

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
- repository URL must match the repository being discovered
- trusted repository owner
- typed category and status values
- unique IDs and paths

See `examples/tool.manifest.json` for the contract shape.


## Hero artwork

The hero dot field currently morphs between:

- `/static/icons/tool.svg`
- `/static/icons/time.svg`

These are temporary defaults. Replace or extend the `images` passed to `DotField` when the final Open Tools icon/logo is available. The renderer samples transparent SVG/image artwork into the ambient dot field, following the same local image-to-dot approach used by the Raksara hero.


## Reusable UI components

The shell now keeps common UI primitives in `src/lib/components`:

- `SearchOverlay.svelte` — keyboard-driven tool search overlay
- `ThemeToggle.svelte` — persisted light/dark theme switch
- `SurfaceCard.svelte` — reusable glass/bento card
- `DataTable.svelte` — horizontally scrollable mobile-safe table
- `Carousel.svelte` — snap-scrolling responsive carousel
- `DotField.svelte` — image-driven animated dot mesh with morph transitions

The components use shared CSS variables from `src/routes/app.css` so light/dark themes and future accent changes stay consistent.

## Search

Press `/` or `Cmd/Ctrl + K` anywhere outside a text input to open the search overlay. On mobile, the search action remains a 44px+ touch target in the header.

## Theme

Theme preference is stored in `localStorage` under `open-tools-theme`. When no preference exists, the shell follows `prefers-color-scheme`. Theme initialization runs in `app.html` before Svelte mounts to avoid a light/dark flash.
