// Normalizes optional PageSpeed Insights categories into small, bounded, inert structures.
// Everything here is optional: a missing category yields null and never fails the SEO audit.
export const text = (value, max = 2000) => typeof value === 'string' ? value.slice(0, max) : '';
const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const unitScore = value => { const number = finite(value); return number !== null && number >= 0 && number <= 1 ? number : null; };

export function normalizeAudit(lh, ref, { description = 2000, evidenceItems = 8, evidenceLength = 512 } = {}) {
  const audit = lh.audits?.[ref.id];
  if (!audit) return { id: text(ref.id, 100), score: null, mode: 'error', title: '', description: '', evidence: [] };
  const evidence = [];
  for (const row of (Array.isArray(audit.details?.items) ? audit.details.items : []).slice(0, evidenceItems)) {
    for (const value of Object.values(row ?? {})) {
      const sample = typeof value === 'string' ? value : value?.snippet ?? value?.nodeLabel ?? value?.explanation;
      if (typeof sample === 'string' && sample.trim()) evidence.push(sample.slice(0, evidenceLength));
      if (evidence.length >= evidenceItems) break;
    }
    if (evidence.length >= evidenceItems) break;
  }
  return { id: text(ref.id, 100), score: unitScore(audit.score), mode: text(audit.scoreDisplayMode, 40), title: text(audit.title, 300), description: text(audit.description, description), displayValue: text(audit.displayValue, 300), group: text(ref.group, 60), evidence };
}

/** Accessibility / best-practices: score plus compact audits (not-applicable ones carry no prose). */
export function normalizeGroup(lh, key, maximum = 70) {
  const category = lh?.categories?.[key];
  const score = unitScore(category?.score);
  if (score === null || !Array.isArray(category.auditRefs)) return null;
  const audits = category.auditRefs.slice(0, maximum).map(ref => {
    const full = normalizeAudit(lh, ref, { description: 360, evidenceItems: 3, evidenceLength: 240 });
    if (full.mode === 'notApplicable') return { id: full.id, score: null, mode: full.mode, title: full.title, group: full.group, description: '', evidence: [] };
    return full;
  });
  return { score: Math.round(score * 100), audits };
}

const METRIC_AUDITS = { fcp: 'first-contentful-paint', lcp: 'largest-contentful-paint', tbt: 'total-blocking-time', cls: 'cumulative-layout-shift', si: 'speed-index', ttfb: 'server-response-time', tti: 'interactive' };

function findSnippet(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 5) return '';
  if (typeof node.snippet === 'string' && node.snippet) return node.snippet;
  for (const value of Object.values(node)) {
    const found = findSnippet(value, depth + 1);
    if (found) return found;
  }
  return '';
}

function normalizeOpportunities(lh, category) {
  const skip = new Set(Object.values(METRIC_AUDITS));
  const rows = [];
  for (const ref of category.auditRefs ?? []) {
    const audit = lh.audits?.[ref.id];
    if (!audit || skip.has(ref.id) || !['load-opportunities', 'diagnostics'].includes(ref.group)) continue;
    const score = unitScore(audit.score);
    if (score === null || score >= 0.9 || ['manual', 'notApplicable', 'informative'].includes(audit.scoreDisplayMode)) continue;
    rows.push({ id: text(ref.id, 100), title: text(audit.title, 200), description: text(audit.description, 360), displayValue: text(audit.displayValue, 120), score, savingsMs: finite(audit.details?.overallSavingsMs) ?? 0, savingsBytes: finite(audit.details?.overallSavingsBytes) ?? 0 });
  }
  return rows.sort((a, b) => b.savingsMs - a.savingsMs || a.score - b.score).slice(0, 8);
}

export function normalizePerformance(lh) {
  const category = lh?.categories?.performance;
  const score = unitScore(category?.score);
  if (score === null) return null;
  const metrics = [];
  for (const [id, auditId] of Object.entries(METRIC_AUDITS)) {
    const audit = lh.audits?.[auditId];
    const value = finite(audit?.numericValue);
    if (value === null) continue;
    metrics.push({ id, value, score: unitScore(audit.score), displayValue: text(audit.displayValue, 60) });
  }
  const resources = (Array.isArray(lh.audits?.['resource-summary']?.details?.items) ? lh.audits['resource-summary'].details.items : []).slice(0, 12)
    .map(row => ({ type: text(row.resourceType, 30), requests: finite(row.requestCount) ?? 0, bytes: finite(row.transferSize) ?? 0 }));
  return {
    score: Math.round(score * 100),
    metrics,
    opportunities: normalizeOpportunities(lh, category),
    lcpElement: text(findSnippet(lh.audits?.['largest-contentful-paint-element']?.details), 300),
    resources,
    totalBytes: finite(lh.audits?.['total-byte-weight']?.numericValue),
    domSize: finite(lh.audits?.['dom-size']?.numericValue)
  };
}

const FIELD_METRICS = { LARGEST_CONTENTFUL_PAINT_MS: 'lcp', FIRST_CONTENTFUL_PAINT_MS: 'fcp', CUMULATIVE_LAYOUT_SHIFT_SCORE: 'cls', INTERACTION_TO_NEXT_PAINT: 'inp', EXPERIMENTAL_TIME_TO_FIRST_BYTE: 'ttfb' };
const FIELD_RATINGS = { FAST: 'good', AVERAGE: 'needs', SLOW: 'poor' };

/** Chrome UX Report field data, when Google has enough real-user samples for the URL or origin. */
export function normalizeField(data) {
  const experience = data?.loadingExperience;
  if (!experience?.metrics || typeof experience.metrics !== 'object') return null;
  const metrics = [];
  for (const [key, id] of Object.entries(FIELD_METRICS)) {
    const metric = experience.metrics[key];
    const percentile = finite(metric?.percentile);
    if (percentile === null) continue;
    metrics.push({ id, value: id === 'cls' ? percentile / 100 : percentile, rating: FIELD_RATINGS[metric.category] ?? 'unknown' });
  }
  if (!metrics.length) return null;
  return { overall: FIELD_RATINGS[experience.overall_category] ?? 'unknown', originFallback: experience.origin_fallback === true, metrics };
}

/** Request URLs seen by Lighthouse; used only for technology detection and counts, never returned. */
export function networkUrls(lh) {
  const items = lh?.audits?.['network-requests']?.details?.items;
  if (!Array.isArray(items)) return { urls: [], requests: null };
  return { urls: items.slice(0, 200).map(item => text(item?.url, 300)).filter(Boolean), requests: items.length };
}
