import test from 'node:test';
import assert from 'node:assert/strict';
import { verifySourceAccess } from '../scripts/lib/registry-preflight.mjs';

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
