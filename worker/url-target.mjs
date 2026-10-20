// Shared URL guard for every outbound request this Worker makes on behalf of a tool.
export class AuditFailure extends Error { constructor(code, status = 502) { super(code); this.status = status; } }
export function validateTarget(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\\\u0000-\u001f]/.test(value)) throw new AuditFailure('invalid-url', 400);
  let url; try { url = new URL(value); } catch { throw new AuditFailure('invalid-url', 400); }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || !host.includes('.') || /[:\[\]]/.test(host) || /^[\d.]+$/.test(host) || /(?:^|\.)(?:localhost|local|internal|test|invalid|example|onion|home|lan)$/.test(host)) throw new AuditFailure('invalid-url', 400);
  // URLs are sent to Google: avoid common accidental credential-bearing links.
  if ([...url.searchParams.keys()].some(key => /^(?:token|access_token|api_key|key|password|secret|authorization|code|signature|sig)$/i.test(key))) throw new AuditFailure('invalid-url', 400);
  url.hash = ''; return url.href;
}
