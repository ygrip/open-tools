import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateAdsConfig, hostFramePolicy } from '../src/lib/ads/config.js';

const disabledPolicy = 'frame-src about: https://challenges.cloudflare.com';
const enabled = {
  enabled: true, client: 'ca-pub-1234567890123456', testMode: true,
  placements: { home: '1234567890', tool: '0987654321' },
  frameOrigins: ['https://googleads.g.doubleclick.net', 'https://*.safeframe.googlesyndication.com']
};

test('advertising defaults off and deployment configuration is valid', async () => {
  const raw = JSON.parse(await readFile(new URL('../config/ads.json', import.meta.url), 'utf8'));
  assert.doesNotThrow(() => validateAdsConfig(raw));
  const config = validateAdsConfig({});
  assert.deepEqual(config, { enabled: false, client: '', testMode: true, placements: { home: '', tool: '' }, frameOrigins: [] });
  assert.equal(hostFramePolicy(config), disabledPolicy);
});

test('enabled ads retain explicit slots, test mode and only the configured host frame origins', () => {
  const config = validateAdsConfig(enabled);
  assert.deepEqual(config, enabled);
  assert.equal(hostFramePolicy(config), `${disabledPolicy} ${enabled.frameOrigins.join(' ')}`);
  assert.equal(validateAdsConfig({ ...enabled, placements: { home: '', tool: '1234567890' }, testMode: false }).placements.home, '');
  assert.equal(hostFramePolicy(validateAdsConfig({ ...enabled, enabled: false })), disabledPolicy);
});

for (const [name, patch, message] of [
  ['missing client', { client: '' }, /require ads.client/],
  ['invalid client', { client: 'pub-123' }, /Invalid ads.client/],
  ['missing slots', { placements: {} }, /at least one placement/],
  ['invalid slot', { placements: { home: '" onclick="bad' } }, /Invalid ads.placements.home/],
  ['missing frame allowlist', { frameOrigins: [] }, /explicit ads.frameOrigins/],
  ['string toggle', { enabled: 'true' }, /must be a boolean/],
  ['string test toggle', { testMode: 'false' }, /must be a boolean/],
  ['invalid placements', { placements: [] }, /must be an object/]
]) {
  test(`advertising configuration rejects ${name}`, () => {
    assert.throws(() => validateAdsConfig({ ...enabled, ...patch }), message);
  });
}

for (const origin of ['https:', '*', 'http://ads.example', 'https://example.com/path', 'https://user@example.com', 'https://example.com:443', 'https://example.com; frame-src *', 'https://example.com" onload="bad', 'https://*']) {
  test(`CSP origin validation rejects ${origin}`, () => {
    assert.throws(() => validateAdsConfig({ ...enabled, frameOrigins: [origin] }), /HTTPS DNS origins/);
  });
}

test('advertising frame origins are bounded and deduplicated', () => {
  assert.throws(() => validateAdsConfig({ ...enabled, frameOrigins: Array(17).fill('https://ads.example') }), /at most 16/);
  assert.deepEqual(validateAdsConfig({ ...enabled, frameOrigins: ['https://ads.example', 'https://ads.example'] }).frameOrigins, ['https://ads.example']);
});
