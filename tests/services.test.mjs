import test from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest } from '../src/lib/registry/contract.js';
import { compileServices } from '../scripts/lib/services.mjs';
import { readFile } from 'node:fs/promises';
const original = JSON.parse(await readFile(new URL('../examples/tool.manifest.json', import.meta.url)));
const service = { id: 'audit', handler: 'pagespeed-seo', rateLimit: { limit: 5, periodSeconds: 60 }, turnstile: true };
const manifest = { ...original, id: "seo-checker", path: "/seo-checker", permissions: [{ name: 'services', required: true, reason: 'Audit a public page' }], services: [service] };
test('service policy accepts reviewed bounded features and keeps existing tools compatible', () => {
  assert.deepEqual(validateManifest(manifest).services, [service]);
  assert.deepEqual(validateManifest({ ...manifest, services: undefined, permissions: [] }).services, []);
  for (const change of [{ services: [{ ...service, handler: 'https://evil.example' }] }, { services: [service, service] }, { permissions: [] }, { services: [{ ...service, rateLimit: { limit: 100000, periodSeconds: 60 } }] }, { services: [{ ...service, rateLimit: { limit: 5, periodSeconds: 3600 } }] }, { services: [{ ...service, turnstile: 'false' }] }, { services: [{ ...service, endpoint: 'https://evil.example' }] }]) assert.throws(() => validateManifest({ ...manifest, ...change }));
});
test('service compilation creates deterministic isolated authoritative policies and native bindings', () => {
  const a = validateManifest(manifest);
  const b = validateManifest({ ...manifest, id: 'other-tool', path: '/other-tool', services: [{ ...service, rateLimit: { limit: 2, periodSeconds: 10 }, turnstile: false }] });
  const result = compileServices([a, b]);
  assert.deepEqual(result, compileServices([b, a]));
  assert.equal(result.bindings.length, 2);
  assert.notEqual(result.policies['seo-checker/audit'].binding, result.policies['other-tool/audit'].binding);
  assert.equal(result.policies['seo-checker/audit'].turnstile, true);
  assert.equal(result.policies['other-tool/audit'].rateLimit.limit, 2);
  assert.equal(result.policies['seo-checker/audit'].sha256, manifest.bundle.sha256);
});

test('tracker-audit is a reviewed fixed handler and cannot register arbitrary endpoints',()=>{const audit={...service,handler:'tracker-audit'};assert.equal(validateManifest({...manifest,services:[audit]}).services[0].handler,'tracker-audit');assert.throws(()=>validateManifest({...manifest,services:[{...audit,handler:'https://evil.example'}]}));});
