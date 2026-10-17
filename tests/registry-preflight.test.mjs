import test from 'node:test';
import assert from 'node:assert/strict';
import { verifySourceAccess } from '../scripts/lib/registry-preflight.mjs';
import { createCredentialResolver } from '../scripts/lib/credentials.mjs';

const refs = [
  { id: 'one', source: { repository: 'ygrip/one', ref: 'a'.repeat(40) } },
  { id: 'two', source: { repository: 'ygrip/two', ref: 'b'.repeat(40) } }
];

test('preflight probes all pinned manifests using caller credentials', async () => {
  const requests = [];
  const result = await verifySourceAccess(refs, async (path) => {
    requests.push(path);
    return { type: 'file', content: 'base64-content' };
  });
  assert.equal(result, 2);
  assert.deepEqual(requests, refs.map(({ source }) => `/repos/${source.repository}/contents/tool.manifest.json?ref=${source.ref}`));
});

test('private GitHub 404 is described as an access failure, not a missing release', async () => {
  await assert.rejects(
    verifySourceAccess(refs, async (path) => {
      if (path.includes('/one/')) throw new Error('GitHub 404');
      return { type: 'file', content: 'ok' };
    }),
    (error) => /ygrip\/one@/.test(error.message) && /private repository inaccessible/.test(error.message) && !/ygrip\/two@/.test(error.message)
  );
});

test('preflight skips intentionally local fixtures but fails closed on invalid responses', async () => {
  assert.equal(await verifySourceAccess([{ id: 'fixture', source: { repository: 'ygrip/fixture', local: 'examples/fixture' } }], () => {
    throw new Error('should not fetch local fixtures');
  }), 0);
  await assert.rejects(verifySourceAccess(refs, async () => ({ type: 'dir' })), /access check failed for 2 source/);
});

test('cross-owner registrations resolve independently, with anonymous public fallback', async () => {
  const credentials = createCredentialResolver({
    auth: { owners: {
      alice: { tokenEnv: 'ALICE_TEST_KEY' },
      bob: { tokenEnv: 'BOB_TEST_KEY' }
    } }
  }, { env: { ALICE_TEST_KEY: 'alpha', BOB_TEST_KEY: 'beta' } });
  const sources = [
    { source: { repository: 'alice/text', ref: 'a'.repeat(40) } },
    { source: { repository: 'bob/image', ref: 'b'.repeat(40) } },
    { source: { repository: 'public/tool', ref: 'c'.repeat(40) } }
  ];
  const used = [];
  const count = await verifySourceAccess(sources, async (path) => {
    const repository = path.split('/').slice(2, 4).join('/');
    used.push(await credentials.forRepository(repository));
    return { type: 'file', content: 'ok' };
  });
  assert.equal(count, 3);
  assert.deepEqual(used, ['alpha', 'beta', undefined]);
});

test('a missing owner-specific secret is an actionable failure', async () => {
  const credentials = createCredentialResolver({
    auth: { owners: { alice: { tokenEnv: 'ALICE_TEST_KEY' } } }
  }, { env: {} });
  await assert.rejects(
    verifySourceAccess([{ source: { repository: 'alice/private', ref: 'd'.repeat(40) } }],
      async () => {
        await credentials.forRepository('alice/private');
        return { type: 'file', content: 'ok' };
      }),
    /Missing configured credential: ALICE_TEST_KEY/
  );
});
