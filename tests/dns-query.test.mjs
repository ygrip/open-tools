import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
let source = await readFile(new URL('../src/lib/runtime/dns.ts', import.meta.url), 'utf8');
source = source.replace("import { RuntimeFailure } from './core';", "class RuntimeFailure extends Error { constructor(code,status){super(code);this.code=code;this.status=status;} }");
const out = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { dnsName, dnsUrl, fetchDns } = await import('data:text/javascript;base64,' + Buffer.from(out).toString('base64'));
test('accepts only public ASCII hostnames and whitelisted record types', () => {
  assert.equal(dnsName({ name: 'Example.COM.', type: 'A' }), 'example.com');
  assert.equal(dnsName({ name: 'xn--pypal-4ve.com', type: 'CAA' }), 'xn--pypal-4ve.com');
  for (const name of ['localhost', '127.0.0.1', 'a.internal', 'bad name.com', 'a..b.com', 'https://x.com', 'pаypal.com', '1.2.3.4', 'x.arpa', 'a'.repeat(260) + '.com']) assert.throws(() => dnsName({ name, type: 'A' }), undefined, name);
  for (const type of ['ANY', 'AXFR', 'a', '', 'TXT;x']) assert.throws(() => dnsName({ name: 'example.com', type }));
});
test('queries three fixed resolvers without credentials or redirects and normalises answers', async () => {
  const seen = [];
  const reply = (extra) => Response.json({ Status: 0, AD: true, Answer: [{ name: 'example.com.', type: 5, TTL: 60, data: 'target.example.net.', ...extra }, { name: 'x', type: 99, data: 'ignored' }], extra: 'dropped' });
  const result = await fetchDns({ name: 'example.com', type: 'CNAME' }, new AbortController().signal, async (url, options) => { seen.push([new URL(url).hostname, options.credentials, options.redirect, options.referrerPolicy]); return reply(); });
  assert.deepEqual(seen.map((s) => s[0]).sort(), ['cloudflare-dns.com', 'dns.google', 'security.cloudflare-dns.com']);
  assert.ok(seen.every((s) => s[1] === 'omit' && s[2] === 'error' && s[3] === 'no-referrer'));
  assert.equal(result.results.length, 3);
  assert.deepEqual(result.results[0].answers, [{ name: 'example.com.', type: 'CNAME', ttl: 60, data: 'target.example.net.' }]);
  assert.equal(result.results[0].ad, true); assert.equal(result.results[0].extra, undefined);
  assert.ok(dnsUrl({ url: 'https://dns.google/resolve' }, 'example.com', 'A').includes('do=1'));
});
test('survives one failing provider, fails when both fail and rejects oversize bodies', async () => {
  const one = await fetchDns({ name: 'example.com', type: 'A' }, new AbortController().signal, async (url) => { if (String(url).includes('google')) throw new Error('down'); return Response.json({ Status: 3 }); });
  assert.equal(one.results.length, 2); assert.equal(one.results[0].status, 3);
  await assert.rejects(fetchDns({ name: 'example.com', type: 'A' }, new AbortController().signal, async () => { throw new Error('down'); }));
  await assert.rejects(fetchDns({ name: 'example.com', type: 'A' }, new AbortController().signal, async () => new Response('x'.repeat(70000))));
});
