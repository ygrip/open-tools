import test from 'node:test';
import assert from 'node:assert/strict';
import { mapBounded } from '../scripts/lib/concurrency.mjs';

test('pinned source fetches are bounded and retain input order despite network timing', async () => {
  let active = 0, peak = 0;
  const results = await mapBounded(Array.from({ length: 14 }, (_, i) => i), 4, async (value) => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, (14 - value) % 5 * 4));
    active--;
    return value * 3;
  });
  assert.deepEqual(results, Array.from({ length: 14 }, (_, i) => i * 3));
  assert.equal(peak, 4);
  assert.equal(active, 0);
});

test('one failed source stops scheduling and waits for in-flight verification before rejection', async () => {
  let active = 0, started = 0;
  await assert.rejects(mapBounded(Array.from({ length: 30 }, (_, i) => i), 3, async value => {
    started++; active++;
    try {
      await new Promise(resolve => setTimeout(resolve, value === 1 ? 3 : 18));
      if (value === 1) throw new Error('integrity mismatch');
      return value;
    } finally { active--; }
  }), /integrity mismatch/);
  assert.equal(active, 0);
  assert.ok(started <= 3, `no additional sources should start once a failure is known, saw ${started}`);
});

test('invalid concurrency is refused', async () => {
  await assert.rejects(mapBounded([1], 0, async x => x), /concurrency/);
  await assert.rejects(mapBounded([1], 9, async x => x), /concurrency/);
});
