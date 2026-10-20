// Fetches the audited page itself (headers, markup, robots.txt, llms.txt) with SSRF-hardened, bounded requests.
// The raw document never leaves this Worker: only extracted, bounded facts are returned to the tool.
import { AuditFailure, validateTarget } from './url-target.mjs';
import { extractPage } from './page-extract.mjs';
import { detectTechnology } from './tech-detect.mjs';
import { analyzeLlmsTxt, analyzeRobots } from './robots-analysis.mjs';

export const PAGE_LIMITS = { redirects: 5, documentBytes: 512 * 1024, textBytes: 128 * 1024, timeoutMs: 15_000 };
const USER_AGENT = 'trick-it-seo-checker/1.0 (+https://tools.readynaz.com)';
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
// Allow-list: only these response headers are ever reported. Cookies and authentication headers never are.
const REPORTED_HEADERS = ['content-type', 'content-language', 'content-encoding', 'cache-control', 'vary', 'link', 'x-robots-tag', 'content-security-policy', 'content-security-policy-report-only', 'strict-transport-security', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'cross-origin-resource-policy', 'access-control-allow-origin', 'access-control-allow-credentials', 'access-control-allow-methods', 'access-control-allow-headers', 'access-control-expose-headers', 'server', 'x-powered-by', 'x-generator', 'via', 'alt-svc', 'age', 'last-modified', 'etag', 'cf-ray', 'x-vercel-id', 'x-nf-request-id', 'x-amz-cf-id', 'x-served-by', 'x-shopid', 'x-akamai-transformed'];

function reportedHeaders(headers) {
  const result = {};
  for (const name of REPORTED_HEADERS) {
    const value = headers.get(name);
    if (value) result[name] = value.slice(0, 1200);
  }
  const cookies = headers.getSetCookie?.() ?? [];
  result['set-cookie-count'] = String(cookies.length);
  return result;
}

/** Read at most `maximum` bytes; truncate rather than fail so a long page still yields head facts. */
async function readText(response, maximum) {
  if (!response.body) return { text: '', truncated: false };
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  let truncated = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      chunks.push(value);
      if (size >= maximum) { truncated = true; await reader.cancel(); break; }
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(Math.min(size, maximum));
  let offset = 0;
  for (const chunk of chunks) {
    const room = bytes.length - offset;
    if (room <= 0) break;
    bytes.set(chunk.subarray(0, room), offset);
    offset += Math.min(chunk.length, room);
  }
  return { text: new TextDecoder('utf-8', { fatal: false }).decode(bytes), truncated };
}

/**
 * GET with manual redirects. Every hop is re-validated, so a redirect can never reach an
 * internal, credential-bearing, non-HTTP(S) or non-standard-port target.
 */
export async function fetchPublic(target, fetcher, { maximum, accept }) {
  const chain = [];
  let current = validateTarget(target);
  for (let hop = 0; hop <= PAGE_LIMITS.redirects; hop++) {
    const response = await fetcher(current, {
      method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(PAGE_LIMITS.timeoutMs),
      headers: { accept, 'user-agent': USER_AGENT, 'accept-language': 'en' }
    });
    const location = response.headers.get('location');
    if (!REDIRECT_STATUSES.has(response.status) || !location) {
      const { text, truncated } = await readText(response, maximum);
      return { url: current, status: response.status, headers: response.headers, text, truncated, redirects: chain };
    }
    await response.body?.cancel();
    chain.push({ status: response.status, url: current.slice(0, 300) });
    let next;
    try { next = validateTarget(new URL(location, current).href); } catch { throw new AuditFailure('redirect-blocked', 502); }
    current = next;
  }
  throw new AuditFailure('too-many-redirects', 502);
}

function auxiliaryUrl(pageUrl, path) {
  return new URL(path, new URL(pageUrl).origin).href;
}

async function fetchAuxiliary(pageUrl, path, fetcher, accept) {
  try {
    const result = await fetchPublic(auxiliaryUrl(pageUrl, path), fetcher, { maximum: PAGE_LIMITS.textBytes, accept });
    return { status: result.status, contentType: result.headers.get('content-type') ?? '', text: result.text };
  } catch { return null; }
}

function documentSummary(document, html) {
  const headers = reportedHeaders(document.headers);
  return {
    url: document.url,
    status: document.status,
    headers,
    redirects: document.redirects,
    truncated: document.truncated,
    contentLength: html.length
  };
}

/** @returns {Promise<object>} bounded facts, or `{ error }` when the page itself cannot be read. */
export async function inspectPage(target, fetcher = fetch) {
  let document;
  try { document = await fetchPublic(target, fetcher, { maximum: PAGE_LIMITS.documentBytes, accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1' }); }
  catch (error) { return { error: error instanceof AuditFailure ? error.message : 'page-unreachable' }; }
  const contentType = document.headers.get('content-type') ?? '';
  if (!/html|xml/i.test(contentType) && contentType) return { error: 'not-html', document: documentSummary(document, '') };
  const [robotsResponse, llmsResponse] = await Promise.all([
    fetchAuxiliary(document.url, '/robots.txt', fetcher, 'text/plain,*/*;q=0.1'),
    fetchAuxiliary(document.url, '/llms.txt', fetcher, 'text/plain,text/markdown,*/*;q=0.1')
  ]);
  const facts = extractPage(document.text, document.url);
  const summary = documentSummary(document, document.text);
  const urls = [...facts.scripts, ...facts.links.stylesheets];
  const path = new URL(document.url).pathname + new URL(document.url).search;
  return {
    document: summary,
    ...facts,
    robots: robotsResponse ? analyzeRobots({ status: robotsResponse.status, text: robotsResponse.text, path }) : { present: false, unreachable: true, crawlers: {}, sitemaps: [], pageAllowedForGooglebot: true },
    llmsTxt: llmsResponse ? analyzeLlmsTxt(llmsResponse) : { present: false },
    technology: detectTechnology({ headers: summary.headers, meta: facts.meta, urls, html: document.text.slice(0, 300_000) })
  };
}
