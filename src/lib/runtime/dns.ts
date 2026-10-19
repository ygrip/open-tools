import { RuntimeFailure } from './core';

export type DnsQueryRequest = { name: string; type: string };
export const DNS_TYPES = ['A', 'AAAA', 'CNAME', 'NS', 'MX', 'TXT', 'CAA', 'SOA', 'DS', 'DNSKEY'] as const;
const NAME = /^(?=.{3,253}$)(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?\.)+[a-z][a-z0-9-]{1,62}$/;
const LIMIT = 64 * 1024;
const TYPE_NUMBERS: Record<number, string> = { 1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 15: 'MX', 16: 'TXT', 28: 'AAAA', 43: 'DS', 48: 'DNSKEY', 257: 'CAA' };
// Fixed public DoH resolvers (CORS JSON API): Cloudflare, Google and Cloudflare's security-filtering resolver. The sandboxed tool never chooses a URL or provider.
const PROVIDERS = [
  { id: 'cloudflare', url: 'https://cloudflare-dns.com/dns-query' },
  { id: 'google', url: 'https://dns.google/resolve' },
  // Cloudflare's malware/phishing-blocking resolver (1.1.1.2): a blocked domain answers 0.0.0.0 or NXDOMAIN.
  { id: 'cloudflare-security', url: 'https://security.cloudflare-dns.com/dns-query' }
] as const;

/** Public ASCII hostnames only. Internationalised names must already be Punycode (URL.hostname form). */
export function dnsName(request: DnsQueryRequest): string {
  if (!request || typeof request.name !== 'string' || typeof request.type !== 'string') throw new RuntimeFailure('invalid-request');
  const name = request.name.toLowerCase().replace(/\.$/, '');
  if (!NAME.test(name) || /(?:^|\.)(?:localhost|local|internal|test|invalid|onion|home|lan|corp|intranet|private|arpa)$/.test(name) ||
      !(DNS_TYPES as readonly string[]).includes(request.type)) throw new RuntimeFailure('invalid-request');
  return name;
}

export function dnsUrl(provider: (typeof PROVIDERS)[number], name: string, type: string): string {
  const url = new URL(provider.url);
  url.searchParams.set('name', name); url.searchParams.set('type', type); url.searchParams.set('do', '1');
  return url.href;
}

function normalise(provider: string, body: any) {
  const answers = (list: unknown) => (Array.isArray(list) ? list : []).slice(0, 24).flatMap((record: any) => {
    const type = TYPE_NUMBERS[record?.type] ?? null;
    if (!type || typeof record.name !== 'string' || typeof record.data !== 'string') return [];
    return [{ name: record.name.slice(0, 253), type, ttl: Number.isSafeInteger(record.TTL) ? record.TTL : 0, data: record.data.slice(0, 512) }];
  });
  return { provider, status: Number.isInteger(body?.Status) ? body.Status : -1, ad: body?.AD === true, cd: body?.CD === true, answers: answers(body?.Answer), authority: answers(body?.Authority).slice(0, 4) };
}

async function ask(provider: (typeof PROVIDERS)[number], name: string, type: string, signal: AbortSignal, fetcher: typeof fetch) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 8000);
  try {
    const response = await fetcher(dnsUrl(provider, name, type), { signal: controller.signal, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', cache: 'no-store', headers: { accept: 'application/dns-json' } });
    if (!response.ok || response.type === 'opaque' || !response.body) throw new RuntimeFailure('request', response.status);
    if (Number(response.headers.get('content-length') || 0) > LIMIT) throw new RuntimeFailure('size');
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value!.byteLength;
        if (total > LIMIT) throw new RuntimeFailure('size');
        chunks.push(value!);
      }
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
    const bytes = new Uint8Array(total); let at = 0;
    for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
    return normalise(provider.id, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  } finally { clearTimeout(timer); signal.removeEventListener('abort', cancel); }
}

/** dig-style lookup from the user's browser. Never contacts the queried host itself. */
export async function fetchDns(request: DnsQueryRequest, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const name = dnsName(request);
  const settled = await Promise.allSettled(PROVIDERS.map((provider) => ask(provider, name, request.type, signal, fetcher)));
  if (signal.aborted) throw new RuntimeFailure('aborted');
  const results = settled.flatMap((entry) => (entry.status === 'fulfilled' ? [entry.value] : []));
  if (!results.length) throw new RuntimeFailure('request');
  return { name, type: request.type, results };
}
