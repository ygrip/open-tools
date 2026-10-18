// A fixed-provider SEO service. Never fetch the supplied URL in this Worker.
const API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
export class AuditFailure extends Error { constructor(code, status = 502) { super(code); this.status = status; } }
const text = (value, max = 2000) => typeof value === 'string' ? value.slice(0, max) : '';
export function validateTarget(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\\\u0000-\u001f]/.test(value)) throw new AuditFailure('invalid-url', 400);
  let url; try { url = new URL(value); } catch { throw new AuditFailure('invalid-url', 400); }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || !host.includes('.') || /[:\[\]]/.test(host) || /^[\d.]+$/.test(host) || /(?:^|\.)(?:localhost|local|internal|test|invalid|example|onion|home|lan)$/.test(host)) throw new AuditFailure('invalid-url', 400);
  // URLs are sent to Google: avoid common accidental credential-bearing links.
  if ([...url.searchParams.keys()].some(key => /^(?:token|access_token|api_key|key|password|secret|authorization|code|signature|sig)$/i.test(key))) throw new AuditFailure('invalid-url', 400);
  url.hash = ''; return url.href;
}
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
  const audits = category.auditRefs.map(ref => {
    const audit = lh.audits?.[ref.id];
    if (!audit) return { id: text(ref.id, 100), score: null, mode: 'error', title: '', description: '', evidence: [] };
    const evidence = [];
    for (const row of (Array.isArray(audit.details?.items) ? audit.details.items : []).slice(0, 8)) {
      for (const value of Object.values(row)) {
        const sample = typeof value === 'string' ? value : value?.snippet ?? value?.nodeLabel ?? value?.explanation;
        if (typeof sample === 'string' && sample.trim()) evidence.push(sample.slice(0, 512));
        if (evidence.length >= 8) break;
      }
      if (evidence.length >= 8) break;
    }
    return { id: text(ref.id, 100), score: typeof audit.score === 'number' && Number.isFinite(audit.score) && audit.score >= 0 && audit.score <= 1 ? audit.score : null,
      mode: text(audit.scoreDisplayMode, 40), title: text(audit.title, 300), description: text(audit.description), displayValue: text(audit.displayValue, 300), evidence };
  });
  return { score: Math.round(category.score * 100), url: text(lh.finalUrl, 2048), fetchedAt: text(lh.fetchTime, 80), version: text(lh.lighthouseVersion, 40), warnings: Array.isArray(lh.runWarnings) ? lh.runWarnings.length : 0, audits };
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
    url.searchParams.set('url', target); url.searchParams.set('category', 'SEO'); url.searchParams.set('strategy', body.strategy); url.searchParams.set('locale', body.locale);
    if (env.PAGESPEED_API_KEY) url.searchParams.set('key', env.PAGESPEED_API_KEY);
    controller = new AbortController(); timer = setTimeout(() => controller.abort(), 90_000);
    const response = await fetcher(url, { method: 'GET', redirect: 'error', signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) { await response.body?.cancel(); throw new AuditFailure(response.status === 429 ? 'provider-quota' : 'provider-failed', response.status === 429 ? 429 : 502); }
    const report = normalizeReport(await readJson(response, 4 * 1024 * 1024));
    return json({ ...report, requestedUrl: target, strategy: body.strategy, locale: body.locale });
  } catch (error) {
    // Do not forward provider errors, keys, submitted URLs or exception stacks.
    if (controller?.signal.aborted) return json({ error: 'timeout' }, 504);
    return json({ error: error instanceof AuditFailure ? error.message : 'provider-failed' }, error instanceof AuditFailure ? error.status : 502);
  } finally { clearTimeout(timer); }
}
