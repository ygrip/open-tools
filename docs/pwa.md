# trick-it: PWA, SPA and offline behavior

1. Build and deploy the entire `build/` directory atomically over HTTPS. Localhost also supports service workers. Set the public canonical origin through `PUBLIC_SITE_URL`; see [SEO](seo.md).
2. Open the site online once. Use **Install trick-it**, the browser’s install menu, or Add to Home Screen. Installation availability depends on browser/OS; the button provides instructions when an install prompt is unavailable.
3. Open the tools you need while online. Their validated, digest/version-pinned bundles can then work offline. Deferred external models need a successful consented download first; provider `private`/`no-store` responses are not persisted.
4. When **Update available** appears, choose **Prepare update**. The running tool and its input stay unchanged. Choose **Reload to use the update** only after saving your work. Updates never force a reload.

## Routing and cache boundaries

SvelteKit provides client-side SPA navigation within each locale. All approved routes are also prerendered, so direct links and crawlers receive real HTML. Preserve `404.html` as the host fallback for unknown routes and map the independent 500/503 pages to their matching statuses. Do not rewrite every missing asset to an HTTP 200 homepage.

English URLs remain `/`; Indonesian pages use `/id/`. Language links retain the current route, query and fragment. Switching language deliberately reloads the document to synchronize Paraglide and static document language: save input first and grant a new tool session after switching. Theme changes and in-place SDK locale events do not reload the iframe. Embedded tool SPAs should use component state or hash routing, not assume a same-origin path router.

The service worker precaches this deployment’s shell/chunks/locale pages. Fixed shell files are release-pinned until an approved update, preventing mixed old/new HTML and code. It caches only public successful same-origin GET responses; authorization, private/no-store responses, unapproved query variants, errors and third-party assets are excluded. Social images and crawler files are not precached.

Up to 32 recently opened tool release URLs use a separate bundle cache. Old shell caches remain while older tabs report using them; after clients report their app versions, unused shell caches are removed. Content-addressed old chunks remain available to older tabs. Tool asset caches are separate and rehash bytes before reuse. Quota/storage failures show a warning instead of claiming offline readiness. Clear browser site data to remove installed caches. Revoking a tool grant stops its frame and future broker access; it does not revoke OS/browser site permissions or undo completed actions.

Offline known pages use their saved locale HTML. An unsaved route returns an independent bilingual HTTP 503 offline page, never a fabricated successful homepage. Tools requiring a new model, browser permission, or unavailable API may still need a connection or OS support.

`manifest.webmanifest` uses relative scope/icon URLs. The service worker honors the configured SvelteKit base. The default verified deployment is at the origin root. For a subpath deployment configure `kit.paths.base`, regenerate the build, and verify locale rerouting and all public asset URLs under that mount before deployment; do not edit manifest paths into a different origin.

## Host headers

Serve `service-worker.js` with JavaScript MIME type and `Cache-Control: no-cache`; registration also uses `updateViaCache: none`. Serve bundle JSON as `application/json`. Preserve version query strings in CDN cache keys. Prefer immutable caching for content-hashed JS/CSS/fonts/social images; never immutable-cache mutable HTML or manifest aliases. Error responses need their actual status plus `Cache-Control: no-store`. The platform cannot configure your CDN automatically.

Verification: `npm run test:e2e` includes real offline reload, Indonesian offline navigation, missing-route 503, and a two-service-worker update test proving unsaved iframe input survives activation until explicit reload.
