/**
 * Small, deterministic, fail-closed queue for remote registry reads.
 * On failure, stop scheduling new reads and await all requests already in flight.
 * Results keep registration order; callers do not publish until this resolves.
 */
export async function mapBounded(items, concurrency, load) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new RangeError('concurrency must be between 1 and 8');
  const results = Array(items.length);
  let next = 0;
  let failed = false;
  let failure;
  await Promise.all(Array.from({ length: Math.min(items.length, concurrency) }, async () => {
    while (next < items.length && !failed) {
      const index = next++;
      try { results[index] = await load(items[index], index); }
      catch (error) {
        // Track failure with a flag: a thrown falsy value must still fail closed.
        if (!failed) { failed = true; failure = error; }
      }
    }
  }));
  if (failed) throw failure;
  return results;
}
