# Search and social metadata

Set **`PUBLIC_SITE_URL` to the real HTTPS production origin**, for example through your deployment provider's production environment settings. The value must contain only the origin: no credentials, path, query or fragment. Do not copy a guessed domain into source.

1. Set `PUBLIC_SITE_URL` for production only. Leave it unset for local development and preview deployments.
2. Run registry sync, then `node scripts/generate-seo.mjs`, before the Vite build. The package scripts should perform this sequence automatically.
3. Check the generated HTML, `/robots.txt`, `/sitemap.xml`, and the localized `/og/` images before publishing the complete static build.

An unset origin deliberately produces **`noindex,nofollow`** pages, a deny-all robots file and an empty sitemap. It never emits `localhost`, the prerenderer's dummy host, or a guessed production canonical URL. A production deployment without `PUBLIC_SITE_URL` therefore remains nonindexable until rebuilt with the setting.

## What is generated

- Each page using `Seo.svelte` receives a title/description, robots directive, Open Graph and Twitter large-image metadata, image dimensions/alt text and language metadata.
- A configured production origin enables clean canonical URLs, English/Indonesian alternate links and `x-default`. Tracking queries and fragments never enter canonical URLs. Per-tool metadata uses its localized `seo` fields, falling back to canonical metadata where a translation is absent.
- The homepage receives `WebSite` JSON-LD. Tool routes receive `WebApplication` JSON-LD, including the actual tool version. The generator does not invent prices, ratings, search endpoints or modification dates. JSON-LD escapes HTML delimiters before embedding it in a script element.
- The sitemap covers home, legal and approved tool routes in both locales. A locale with `robots: "noindex"` in its tool SEO metadata is excluded. Error/fallback routes are not sitemap entries.
- The build renders original **1200 × 630 PNG** social cards from host-authored SVG shapes and escaped catalog copy. It does not execute tool HTML or load a tool-supplied image/script/font. The bundled Nunito TTF is used by Resvg so card generation does not require a browser or runtime font requests.

## Social image caching

The generator writes stable previews such as `/og/home-en.png` and `/og/tools/json-tools-id.png`, plus content-addressed filenames. `src/lib/seo/generated.json` maps each page/locale to its hashed filename. `Seo.svelte` uses that mapping automatically, so changed copy, versions or artwork produce a different social-image URL instead of depending on crawler cache expiration.

Platform and tool images have separate namespaces: a valid tool called `home` cannot overwrite the platform's homepage image. Each rendered card must remain below **200 kB**. Social cards are crawler assets, not interactive page imagery: exclude `/og/` from service-worker precaching and the interactive image budget. They must still be deployed with the site. Do not edit generated images by hand.

## Component integration

```svelte
<script lang="ts">
  import Seo from '$lib/components/Seo.svelte';
</script>

<Seo
  title={tool.seo.title}
  description={tool.seo.description}
  path={tool.path}
  keywords={tool.seo.keywords}
  robots={tool.seo.robots}
  {tool}
/>
```

`Seo` accepts `title`, `description`, `path`, optional `locale`, `keywords`, `robots`, `tool` and an optional site-local `image`. Without an explicit locale, it uses Paraglide's current locale. Use the localized tool presentation when passing title, description and `tool`, while retaining the original ID/path/version. The component handles SvelteKit's configured base when constructing head URLs.

Use one `Seo` component per page. Remove duplicate `<title>`, description/canonical/alternate/Open Graph/Twitter/robots tags from that page and shared layouts; keep unrelated preload, theme-color and manifest tags. Error pages should remain explicitly nonindexable.

The default generator assumes the project's root deployment. Its exported `generateSeo({ root, origin, base })` accepts a base path for a deliberately configured subpath deployment; keep that value consistent with SvelteKit and PWA configuration.

## Verification

`tests/seo.test.mjs` checks origin validation, locale/base canonicalization, safe JSON-LD/SVG escaping, preview noindex behavior, sitemap exclusions and content-addressed card output using a deterministic injected renderer. The real Resvg renderer and bundled font are exercised by the production build, not by that test double.

After building, inspect both language variants and a tool route. Confirm canonical/OG URLs use the real public origin, social images return PNGs, the sitemap excludes noindex tools, and permission/loading overlays do not replace the page's server-rendered SEO metadata.
