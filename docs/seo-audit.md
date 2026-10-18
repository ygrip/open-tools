# Public URL SEO audits

The independent `ygrip/seo-checker` repository owns the localized interface, recommendations, build and release HTML. Its single `config/tools/seo-checker.json` registration pins a reviewed commit. The host owns the [protected service framework](protected-services.md), including Turnstile, per-feature native rate limits and a fixed-provider PageSpeed handler. It does not mirror the tool's source or HTML.

SEO Checker 0.2.0 declares `services/audit`: five requests per 60 seconds, with Turnstile required. The runtime confirms the exact URL and device before sending it to Google. No arbitrary iframe network access is enabled, and the Worker never fetches a submitted site itself. Google renders the page for its Lighthouse SEO audit.

## Deployment and quota

Deploy the generated `.wrangler.services.json` configuration and exact verified static/Worker artifact together as described in the service guide. Generic static hosting alone cannot provide the endpoint. The optional `PAGESPEED_API_KEY` secret belongs in the existing Cloudflare Worker, not in a frontend variable, manifest or repository. Google documents keyless requests, but the live keyless probe during implementation returned HTTP 429 for its shared daily quota. A dedicated Google project with the PageSpeed API enabled is recommended for dependable production use; restrict the key to that API and set project quotas.

The interface remains cacheable offline; live audits and Turnstile need internet. Responses are no-store and are not persisted by the tool/host. Submitted URLs are processed by Google and the hosting infrastructure. Never submit confidential or signed links. Public HTTP(S) DNS-style names and standard ports are required; credentials, IP literals, private host suffixes and common credential query parameters are rejected. This is not a complete secret detector.

The provider response is capped at 4 MiB; only SEO references (maximum 80), bounded text and up to eight 512-character evidence samples per audit are returned. The provider has a 90-second deadline and the browser a 100-second deadline. Runtime revocation aborts the browser request and suppresses stale replies; already-sent provider work may continue until its deadline. Quota, nonpublic pages, timeout and null/malformed reports do not produce invented scores.

## Score and localization

The displayed value is Lighthouse's returned SEO category score × 100, rounded. Manual/not-applicable/unavailable checks remain separate from passed checks. The audit covers technical discoverability, not backlink quality, content usefulness, keyword competitiveness, all structured-data requirements, sitewide indexing or ranking predictions. A score of 100 still requires human review. No title-length or keyword-density penalties are invented.

English and Indonesian labels/advice update live without discarding input or results. Original page evidence stays verbatim. Provider descriptions retain the requested language; rerun to request them in another language.

## Sources

- [PageSpeed Insights](https://developers.google.com/speed/docs/insights/v5/get-started) and [API contract](https://developers.google.com/speed/docs/insights/rest/v5/pagespeedapi/runpagespeed).
- [SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) and [JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).
- [Turnstile validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/) and [Cloudflare rate-limit bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
