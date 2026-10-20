// A fixed-provider SEO service. The supplied URL is sent to Google PageSpeed Insights and read once by
// page-inspect.mjs, which only issues bounded, redirect-validated GET requests to that public site and
// returns extracted facts, never the document. This Worker is not a general-purpose URL proxy.
import { AuditFailure, validateTarget } from './url-target.mjs';
import { text, normalizeAudit, normalizeGroup, normalizePerformance, normalizeField, networkUrls } from './psi-categories.mjs';
import { inspectPage } from './page-inspect.mjs';
import { detectTechnology } from './tech-detect.mjs';
export { AuditFailure, validateTarget };
const CATEGORIES = ['SEO', 'PERFORMANCE', 'BEST_PRACTICES', 'ACCESSIBILITY'];
const API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
export async function readJson(response, maximum) {
  if (!response.body) throw new AuditFailure('invalid-report');
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new AuditFailure('size', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new AuditFailure('invalid-report', 400); }
}
export function normalizeReport(data) {
  const lh = data?.lighthouseResult; const category = lh?.categories?.seo;
  if (lh?.runtimeError || !category || typeof category.score !== 'number' || !Number.isFinite(category.score) || category.score < 0 || category.score > 1 || !Array.isArray(category.auditRefs) || !category.auditRefs.length || category.auditRefs.length > 80) throw new AuditFailure('audit-failed');
  const audits = category.auditRefs.map(ref => normalizeAudit(lh, ref));
  const network = networkUrls(lh);
  return {
    score: Math.round(category.score * 100), url: text(lh.finalUrl, 2048), fetchedAt: text(lh.fetchTime, 80), version: text(lh.lighthouseVersion, 40), warnings: Array.isArray(lh.runWarnings) ? lh.runWarnings.length : 0, audits,
    performance: normalizePerformance(lh), bestPractices: normalizeGroup(lh, 'best-practices'), accessibility: normalizeGroup(lh, 'accessibility'), field: normalizeField(data),
    requests: network.requests, networkUrls: network.urls
  };
}
/** Merge technologies seen on the page with those only visible in Lighthouse's network log. */
export function mergeTechnology(page, urls) {
  const known = new Set((page?.technology ?? []).map(item => item.name));
  const fromNetwork = detectTechnology({ urls }).filter(item => !known.has(item.name));
  return [...(page?.technology ?? []), ...fromNetwork].slice(0, 60);
}
export const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...(status === 429 ? { 'retry-after': '60' } : {}) } });
export async function handleAudit(request, env, fetcher = fetch) {
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: 'origin' }, 403);
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '')) return json({ error: 'content-type' }, 415);
  let controller; let timer;
  try {
    const body = await readJson(request, 4096);
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['url', 'strategy', 'locale'].includes(key)) || !['mobile', 'desktop'].includes(body.strategy) || !['en', 'id'].includes(body.locale)) throw new AuditFailure('invalid-request', 400);
    const target = validateTarget(body.url);
    const url = new URL(API);
    url.searchParams.set('url', target); for (const name of CATEGORIES) url.searchParams.append('category', name); url.searchParams.set('strategy', body.strategy); url.searchParams.set('locale', body.locale);
    if (env.PAGESPEED_API_KEY) url.searchParams.set('key', env.PAGESPEED_API_KEY);
    controller = new AbortController(); timer = setTimeout(() => controller.abort(), 90_000);
    // The page inspection never rejects: a page we cannot read must not fail the Lighthouse audit.
    const pageRead = inspectPage(target, fetcher).catch(() => ({ error: 'page-unreadable' }));
    const response = await fetcher(url, { method: 'GET', redirect: 'manual', signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) { await response.body?.cancel(); throw new AuditFailure(response.status === 429 ? 'provider-quota' : 'provider-failed', response.status === 429 ? 429 : 502); }
    const { networkUrls: urls, ...report } = normalizeReport(await readJson(response, 4 * 1024 * 1024));
    const page = await pageRead;
    const { technology: pageTechnology, ...pageWithoutTechnology } = page;
    return json({ ...report, technology: mergeTechnology({ technology: pageTechnology }, urls), page: pageWithoutTechnology, requestedUrl: target, strategy: body.strategy, locale: body.locale });
  } catch (error) {
    // Do not forward provider errors, keys, submitted URLs or exception stacks.
    if (controller?.signal.aborted) return json({ error: 'timeout' }, 504);
    return json({ error: error instanceof AuditFailure ? error.message : 'provider-failed' }, error instanceof AuditFailure ? error.status : 502);
  } finally { clearTimeout(timer); }
}
