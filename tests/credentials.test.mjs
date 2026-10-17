import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, verify } from 'node:crypto';
import { createCredentialResolver } from '../scripts/lib/credentials.mjs';
import { createGithubClient, loadSource } from '../scripts/lib/bundles.mjs';

const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const config = {
  auth: {
    owners: { Acme: { tokenEnv: 'ACME_TOKEN' }, Other: { tokenEnv: 'OTHER_TOKEN' } },
    repositories: { 'ACME/special': { tokenEnv: 'SPECIAL_TOKEN' } }
  }
};
const env = { ACME_TOKEN: 'acme-token', OTHER_TOKEN: 'other-token', SPECIAL_TOKEN: 'special-token', TOOLS_GITHUB_TOKEN: 'global-token', GITHUB_TOKEN: 'github-token' };

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' }
});
const appConfig = { auth: { owners: { acme: { appIdEnv: 'APP_ID', privateKeyEnv: 'APP_KEY', installationId: 42 } } } };
const appEnv = { APP_ID: '12345', APP_KEY: privateKey };

test('repository override beats owner mapping; unconfigured repositories retain both fallbacks', async () => {
  const credentials = createCredentialResolver(config, { env });
  assert.equal(await credentials.forRepository('acme/SPECIAL'), 'special-token');
  assert.equal(await credentials.forRepository('ACME/ordinary'), 'acme-token');
  assert.equal(await credentials.forRepository('other/tool'), 'other-token');
  assert.equal(await credentials.forRepository('unconfigured/tool'), 'global-token');
  assert.equal(await credentials.forOwner('aCmE'), 'acme-token');
  assert.equal(await createCredentialResolver({}, { env: { GITHUB_TOKEN: 'github-token' } }).forRepository('public/tool'), 'github-token');
  assert.equal(await createCredentialResolver({}, { env: {} }).forRepository('public/tool'), undefined);
  const repoOnly = createCredentialResolver({ auth: { repositories: { 'acme/tool': { tokenEnv: 'SPECIAL_TOKEN' } } } }, { env: { SPECIAL_TOKEN: 'special-token' } });
  assert.equal(await repoOnly.forOwner('acme'), undefined);
});

test('explicit missing credentials fail closed instead of falling back', async () => {
  const credentials = createCredentialResolver(config, { env: { TOOLS_GITHUB_TOKEN: 'global-token' } });
  await assert.rejects(credentials.forRepository('acme/tool'), /missing credential environment variable: ACME_TOKEN/);
  await assert.rejects(credentials.forRepository('acme/special'), /SPECIAL_TOKEN/);
  await assert.rejects(credentials.forOwner('other'), /OTHER_TOKEN/);
});

test('credential configuration rejects literals, ambiguous descriptors, unsafe keys and case collisions', () => {
  for (const auth of [
    null,
    { token: 'do-not-publish-me' },
    { owners: [] },
    { owners: { acme: { token: 'do-not-publish-me' } } },
    { owners: { acme: { tokenEnv: 'lowercase' } } },
    { owners: { acme: { tokenEnv: 'ACME_TOKEN', installationId: 1 } } },
    { owners: { acme: { appIdEnv: 'APP_ID', privateKeyEnv: 'APP_KEY', installationId: '42' } } },
    { owners: { acme: { appIdEnv: 'APP_ID', privateKeyEnv: 'APP_KEY', installationId: -1 } } },
    { owners: { Acme: { tokenEnv: 'ACME_TOKEN' }, acme: { tokenEnv: 'OTHER_TOKEN' } } },
    { repositories: { 'acme/../other': { tokenEnv: 'ACME_TOKEN' } } },
    { repositories: { 'Acme/tool': { tokenEnv: 'ACME_TOKEN' }, 'acme/TOOL': { tokenEnv: 'OTHER_TOKEN' } } }
  ]) {
    assert.throws(() => createCredentialResolver({ auth }, { env }), (error) => !error.message.includes('do-not-publish-me'));
  }
  assert.throws(() => createCredentialResolver({ auth: { owners: Object.fromEntries(Array.from({ length: 257 }, (_, i) => [`owner${i}`, { tokenEnv: 'ACME_TOKEN' }])) } }), /exceeds/);
});

test('the API client selects credentials from the actual repository endpoint', async () => {
  const calls = [];
  const github = createGithubClient(createCredentialResolver(config, { env }), async (url, options) => {
    calls.push({ url, options });
    return json({});
  });
  await github('/repos/acme/special/contents/tool.manifest.json?ref=abc', { owner: 'other' });
  await github('/repos/Other/tool/git/blobs/abc');
  await github(`/search/repositories?q=${encodeURIComponent('user:ACME topic:open-tools')}`, { owner: 'Acme' });
  assert.deepEqual(calls.map(({ options }) => options.headers.Authorization), ['Bearer special-token', 'Bearer other-token', 'Bearer acme-token']);
  for (const { options } of calls) assert.equal(options.redirect, 'error');
  await assert.rejects(github(`/search/repositories?q=${encodeURIComponent('user:other')}`, { owner: 'acme' }), /owner scope/);
  await assert.rejects(github(`/search/repositories?q=${encodeURIComponent('user:acme user:other')}`, { owner: 'acme' }), /owner scope/);
  await assert.rejects(github('/search/repositories?q=topic%3Aopen-tools'), /owner scope/);
  await assert.rejects(github(`/search/repositories?q=${encodeURIComponent('user:acme OR repo:other/tool')}`, { owner: 'acme' }), /owner scope/);
  await assert.rejects(github('/search/repositories?q=user%3Aacme&q=user%3Aother', { owner: 'acme' }), /exactly one owner-scoped query/);
  await assert.rejects(github('/user'), /credential context/);
  await assert.rejects(github('//evil.example/path'), /invalid GitHub API path/);
  assert.equal(calls.length, 3);
});

test('two private sources and large-file blob retrieval keep their own credentials', async () => {
  const html = Buffer.from('<!doctype html>' + ' '.repeat(1024 * 1024));
  const calls = [];
  const base = { schemaVersion: 2, appearance: { theme: 'host', protocolVersion: 1 }, name: 'Tool', description: 'Private tool', category: 'data', status: 'experimental', version: '1.0.0', capabilities: [], bundle: { format: 'html', file: 'dist/index.html', sha256: createHash('sha256').update(html).digest('hex') } };
  const file = (bytes) => ({ type: 'file', encoding: 'base64', size: bytes.length, content: bytes.toString('base64') });
  const github = createGithubClient(createCredentialResolver(config, { env }), async (url, options) => {
    calls.push({ url, authorization: options.headers.Authorization });
    const other = url.includes('/Other/');
    if (url.includes('tool.manifest.json')) return json(file(Buffer.from(JSON.stringify({ ...base, id: other ? 'other-tool' : 'acme-tool', path: other ? '/other-tool' : '/acme-tool', repository: other ? 'https://github.com/other/tool' : 'https://github.com/Acme/special' }))));
    if (url.includes('/git/blobs/')) return json(file(html));
    return json({ type: 'file', encoding: 'none', size: html.length, sha: 'b'.repeat(40) });
  });
  const trusted = { trustedOwners: ['ACME', 'other'] };
  const first = await loadSource({ repository: 'acme/special', ref: 'a'.repeat(40) }, trusted, '.', github);
  const second = await loadSource({ repository: 'Other/tool', ref: 'c'.repeat(40) }, trusted, '.', github);
  assert.equal(first.manifest.id, 'acme-tool');
  assert.equal(second.manifest.id, 'other-tool');
  assert.deepEqual(calls.map((call) => call.authorization), ['Bearer special-token', 'Bearer special-token', 'Bearer special-token', 'Bearer other-token', 'Bearer other-token', 'Bearer other-token']);
  assert.ok(!JSON.stringify([first.manifest, second.manifest]).includes('token'));
});

test('GitHub App JWT is valid RS256 with skew; installation tokens cache, deduplicate and refresh', async () => {
  let time = Date.UTC(2026, 0, 1);
  let calls = 0;
  const credentials = createCredentialResolver(appConfig, {
    env: { ...appEnv, APP_KEY: privateKey.replace(/\n/g, '\\n') },
    now: () => time,
    fetcher: async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.github.com/app/installations/42/access_tokens');
      assert.equal(options.method, 'POST');
      assert.equal(options.redirect, 'error');
      assert.deepEqual(JSON.parse(options.body), { permissions: { contents: 'read' } });
      const jwt = options.headers.Authorization.slice('Bearer '.length);
      const [header, payload, signature] = jwt.split('.');
      assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), { alg: 'RS256', typ: 'JWT' });
      const claims = JSON.parse(Buffer.from(payload, 'base64url'));
      assert.equal(claims.iss, '12345');
      assert.equal(claims.iat, Math.floor(time / 1000) - 60);
      assert.equal(claims.exp - claims.iat, 600);
      assert.ok(verify('RSA-SHA256', Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, 'base64url')));
      await Promise.resolve();
      return json({ token: `installation-token-${calls}`, expires_at: new Date(time + 3_600_000).toISOString() });
    }
  });
  assert.deepEqual(await Promise.all([credentials.forRepository('acme/one'), credentials.forRepository('acme/two'), credentials.forOwner('ACME')]), ['installation-token-1', 'installation-token-1', 'installation-token-1']);
  assert.equal(calls, 1);
  time += 3_539_000;
  assert.equal(await credentials.forRepository('acme/three'), 'installation-token-1');
  time += 2_000;
  assert.equal(await credentials.forRepository('acme/four'), 'installation-token-2');
  assert.equal(calls, 2);
});

test('separate App installations and repository overrides never share installation tokens', async () => {
  const installations = [];
  const requests = [];
  const headers = [];
  const app = (installationId) => ({ appIdEnv: 'APP_ID', privateKeyEnv: 'APP_KEY', installationId });
  const credentials = createCredentialResolver({ auth: { owners: { acme: app(42), other: app(43) }, repositories: { 'acme/special': app(44) } } }, {
    env: appEnv,
    fetcher: async (url, options) => {
      const id = Number(url.match(/installations\/(\d+)\//)[1]);
      installations.push(id);
      requests.push(JSON.parse(options.body));
      return json({ token: `installation-${id}`, expires_at: new Date(Date.now() + 3_600_000).toISOString() });
    }
  });
  const github = createGithubClient(credentials, async (_url, options) => {
    headers.push(options.headers.Authorization);
    return json({});
  });
  await github('/repos/acme/ordinary/contents/tool.manifest.json');
  await github('/repos/other/tool/contents/tool.manifest.json');
  await github('/repos/acme/special/contents/tool.manifest.json');
  await github('/search/repositories?q=user%3Aacme', { owner: 'acme' });
  assert.deepEqual(installations, [42, 43, 44]);
  assert.deepEqual(requests, [
    { permissions: { contents: 'read' } },
    { permissions: { contents: 'read' } },
    { permissions: { contents: 'read' }, repositories: ['special'] }
  ]);
  assert.deepEqual(headers, ['Bearer installation-42', 'Bearer installation-43', 'Bearer installation-44', 'Bearer installation-42']);
});

test('API network and malformed-response errors omit credential and response details', async () => {
  const credentials = createCredentialResolver(config, { env });
  const network = createGithubClient(credentials, async () => { throw new Error('sensitive-token-sentinel'); });
  await assert.rejects(network('/repos/acme/tool/contents/file'), (error) => error.message === 'GitHub request failed');
  const invalid = createGithubClient(credentials, async () => new Response('sensitive-token-sentinel'));
  await assert.rejects(invalid('/repos/acme/tool/contents/file'), (error) => error.message === 'GitHub response is not valid JSON');
});

test('GitHub App failures do not expose key/token/response data and can retry', async () => {
  const badKey = createCredentialResolver(appConfig, { env: { APP_ID: '12345', APP_KEY: 'private-secret-sentinel' } });
  await assert.rejects(badKey.forOwner('acme'), (error) => /valid RSA private key/.test(error.message) && !error.message.includes('private-secret-sentinel'));
  const missing = createCredentialResolver(appConfig, { env: { TOOLS_GITHUB_TOKEN: 'fallback-must-not-be-used' } });
  await assert.rejects(missing.forOwner('acme'), /APP_ID/);
  let count = 0;
  const failing = createCredentialResolver(appConfig, { env: appEnv, fetcher: async () => {
    count++;
    if (count === 1) throw new Error('private-key-secret-sentinel');
    return json({ token: 'recovered-token', expires_at: new Date(Date.now() + 3_600_000).toISOString() });
  } });
  await assert.rejects(failing.forOwner('acme'), (error) => error.message === 'GitHub App token request failed');
  assert.equal(await failing.forOwner('acme'), 'recovered-token');
  assert.equal(count, 2);
  for (const response of [json({ token: 'secret-token', expires_at: 'invalid' }), json({ token: 'secret-token', expires_at: new Date(0).toISOString() }), json({ secret: 'sensitive-body' }, 403), new Response('sensitive-body')]) {
    const credentials = createCredentialResolver(appConfig, { env: appEnv, fetcher: async () => response });
    await assert.rejects(credentials.forOwner('acme'), (error) => !/secret-token|sensitive-body/.test(error.message));
  }
});
